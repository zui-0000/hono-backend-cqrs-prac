import { Effect, Schema } from "effect";
import type { Context, Handler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { runtime } from "~/shared/runtime";
import {
  type ApplicationError,
  handleErrorResponse,
} from "./handle-error-response";
import { logFailure, REQUEST_ID_HEADER, resolveRequestId } from "./request-log";
import type { AppServices } from "./types";
import { validateHeader } from "./validator";

/**
 * ユースケースの Effect から HTTP ハンドラを組み立てる (presentation 層の共通処理)。
 *
 * 実行の流れ:
 *   1. 相関 ID を解決し、応答ヘッダに載せる
 *   2. リクエストヘッダを API 契約で検証する (X-Request-Id は必須)
 *   3. ユースケースを実行する
 *   4. 応答ボディを API 契約で検証してから返す
 *
 * 契約とずれた応答はバグなので defect (orDie) として扱い、早期に気付けるようにする。
 * 失敗時は handleErrorResponse が型付きエラーを HTTP 応答へ翻訳し、
 * 内部で何が起きたかは logFailure がサーバーログに残す
 * (外部には定型メッセージのみ返し、原因は露出させない)。
 * 相関 ID は応答ヘッダとログの双方に載せ、フロントエンドのログと突き合わせられる。
 *
 * controller はこの関数の戻り値をそのまま export するため、
 * async / try-catch といった定型を書かずに済む。
 */
export const handleWithEffect =
  <A, ResponseA, ResponseI, HeaderA, HeaderI>(
    status: ContentfulStatusCode,
    responseSchema: Schema.Schema<ResponseA, ResponseI>,
    headerSchema: Schema.Schema<HeaderA, HeaderI>,
    build: (c: Context) => Effect.Effect<A, ApplicationError, AppServices>,
  ): Handler =>
  async (c) =>
    await runtime.runPromise(
      Effect.gen(function* () {
        // 契約違反で弾かれるリクエストもログに残せるよう、ID は先に確定させる。
        const requestId = yield* resolveRequestId(c);
        c.header(REQUEST_ID_HEADER, requestId);

        return yield* validateHeader(c, headerSchema, [REQUEST_ID_HEADER]).pipe(
          Effect.andThen(() => build(c)),
          Effect.flatMap((body) =>
            Schema.decodeUnknown(responseSchema)(body).pipe(Effect.orDie),
          ),
          Effect.map((body) => c.json(body as object, status)),
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
