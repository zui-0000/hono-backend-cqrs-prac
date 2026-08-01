import { Effect, type ManagedRuntime, Schema } from "effect";
import type { Context, Handler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { UuidGenerator } from "~/shared/service/uuid-generator";
import {
  type ApplicationError,
  handleErrorResponse,
} from "./handle-error-response";
import { logFailure, REQUEST_ID_HEADER, resolveRequestId } from "./request-log";
import { validateHeader } from "./validator";

/**
 * ユースケースの Effect から HTTP ハンドラを組み立てる共通処理。
 *
 * 実行の流れ:
 *   1. 相関 ID を解決し、応答ヘッダに載せる
 *   2. リクエストヘッダを API 契約で検証する (X-Request-Id は必須)
 *   3. ユースケースを実行する
 *   4. 結果を HTTP 応答に変換する (respond。成功時の形だけが呼び出し側で異なる)
 *
 * 失敗時は handleErrorResponse が型付きエラーを HTTP 応答へ翻訳し、
 * 内部で何が起きたかは logFailure がサーバーログに残す
 * (外部には定型メッセージのみ返し、原因は露出させない)。
 * 相関 ID は応答ヘッダとログの双方に載せ、フロントエンドのログと突き合わせられる。
 *
 * 戻り値は Handler ではなく「ランタイムを受け取ると Handler になる関数」。
 * Effect は R (依存) が解決されるまで実行できず、その解決を行うのが
 * ManagedRuntime なので、どの実装で動かすかは組み立て時 (app.ts) に決める。
 * ここでランタイムを import してしまうと本番の Layer が焼き付き、
 * テストで差し替えられなくなる。
 *
 * 必要な依存 R は build から推論され、ランタイム側が R を満たさなければ
 * 呼び出し箇所でコンパイルエラーになる (渡し忘れを型で防ぐ)。
 * 相関 ID の採番に UuidGenerator を使うため、R に加えてこれも要求する。
 */
const handle =
  <A, HeaderA, HeaderI, R>(
    headerSchema: Schema.Schema<HeaderA, HeaderI>,
    build: (c: Context) => Effect.Effect<A, ApplicationError, R>,
    respond: (c: Context, value: A) => Effect.Effect<Response>,
  ) =>
  (runtime: ManagedRuntime.ManagedRuntime<R | UuidGenerator, never>): Handler =>
  async (c) =>
    await runtime.runPromise(
      Effect.gen(function* () {
        // 契約違反で弾かれるリクエストもログに残せるよう、ID は先に確定させる。
        const requestId = yield* resolveRequestId(c);
        c.header(REQUEST_ID_HEADER, requestId);

        return yield* validateHeader(c, headerSchema, [REQUEST_ID_HEADER]).pipe(
          Effect.andThen(() => build(c)),
          Effect.flatMap((value) => respond(c, value)),
          Effect.catchAll((error) =>
            handleErrorResponse(error).pipe(
              Effect.tap((response) =>
                logFailure(c, requestId, response.status, error),
              ),
              Effect.map((response) => c.json(response.body, response.status)),
            ),
          ),
        );
      }),
    );

/**
 * 本文を返すハンドラを組み立てる (200 / 201 など)。
 *
 * 応答ボディは返す直前に API 契約 (生成スキーマ) で検証する。
 * 契約とずれた応答はバグなので defect (orDie) として扱い、早期に気付けるようにする。
 *
 * controller はこの関数の戻り値をそのまま export するため、
 * async / try-catch といった定型を書かずに済む。
 */
export const handleWithEffect = <A, ResponseA, ResponseI, HeaderA, HeaderI, R>(
  status: ContentfulStatusCode,
  responseSchema: Schema.Schema<ResponseA, ResponseI>,
  headerSchema: Schema.Schema<HeaderA, HeaderI>,
  build: (c: Context) => Effect.Effect<A, ApplicationError, R>,
): ((
  runtime: ManagedRuntime.ManagedRuntime<R | UuidGenerator, never>,
) => Handler) =>
  handle(headerSchema, build, (c, body) =>
    Schema.decodeUnknown(responseSchema)(body).pipe(
      Effect.orDie,
      Effect.map((decoded) => c.json(decoded as object, status)),
    ),
  );

/**
 * 本文を返さないハンドラを組み立てる (204 No Content)。
 *
 * 更新・削除系のコマンドは状態を変えるだけで値を返さない (CQRS)。
 * 契約上も 204 なので本文がなく、生成スキーマも存在しない
 * (orval は本文のない応答にはスキーマを作らない)。
 * よって検証すべき応答ボディがなく、ユースケースの結果は void に固定できる。
 *
 * 本文ありの版と分けているのは、responseSchema を任意引数にして分岐させるより
 * 型が素直になるため (呼び出し側が「本文を返さない」ことを型で表明できる)。
 */
export const handleNoContentWithEffect = <HeaderA, HeaderI, R>(
  headerSchema: Schema.Schema<HeaderA, HeaderI>,
  build: (c: Context) => Effect.Effect<void, ApplicationError, R>,
): ((
  runtime: ManagedRuntime.ManagedRuntime<R | UuidGenerator, never>,
) => Handler) =>
  handle(headerSchema, build, (c) => Effect.succeed(c.body(null, 204)));
