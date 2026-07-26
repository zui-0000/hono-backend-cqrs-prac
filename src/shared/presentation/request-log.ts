import { Effect } from "effect";
import type { Context } from "hono";
import { UuidGenerator } from "~/shared/service/uuid-generator";
import type { ApplicationError } from "./handle-error-response";

/** 相関 ID のヘッダ名。リクエストから引き継ぎ、応答にも付与する。 */
export const REQUEST_ID_HEADER = "X-Request-Id";

/** 受け取った相関 ID として許容する最大長 (ログ肥大化を防ぐ)。 */
const REQUEST_ID_MAX_LENGTH = 128;

/** ログに混入させない文字を除いた、安全な相関 ID の形式。 */
const SAFE_REQUEST_ID_PATTERN = /^[\w.-]+$/;

/**
 * ログと応答ヘッダに載せる相関 ID を解決する。
 *
 * X-Request-Id は API 契約上は必須で、その検証は validateHeader が行う
 * (欠落・形式不正は 400)。一方この関数は「検証で弾かれたリクエストも
 * ログに残す」ために使うので、契約違反でも失敗させず採番で代替する。
 *
 * 外部由来の値はそのままログに載せるとログインジェクションの恐れがあるため、
 * 長さと文字種を検証し、条件を満たさないものは採番した値で置き換える。
 */
export const resolveRequestId = (
  c: Context,
): Effect.Effect<string, never, UuidGenerator> =>
  Effect.gen(function* () {
    const incoming = c.req.header(REQUEST_ID_HEADER);
    if (
      incoming !== undefined &&
      incoming.length <= REQUEST_ID_MAX_LENGTH &&
      SAFE_REQUEST_ID_PATTERN.test(incoming)
    ) {
      return incoming;
    }
    const uuidGenerator = yield* UuidGenerator;
    return yield* uuidGenerator.next;
  });

/**
 * 失敗したリクエストをログに記録する。
 *
 * 外部にはエラーコードと定型メッセージしか返さないため、
 * 「実際に何が起きていたか」はここでサーバーログに残す。
 * 相関 ID (requestId) を応答ヘッダと共有することで、
 * 特定の問い合わせからログを引けるようにする。
 *
 * 5xx になるインフラ由来の失敗は原因 (cause) まで記録し、
 * 4xx となるクライアント起因の失敗は warn として概要のみ残す。
 */
export const logFailure = (
  c: Context,
  requestId: string,
  status: number,
  error: ApplicationError,
): Effect.Effect<void> => {
  const context = {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status,
    errorTag: error._tag,
  };

  const log =
    status >= 500
      ? Effect.logError("リクエストの処理に失敗しました").pipe(
          Effect.annotateLogs({
            ...context,
            // インフラ由来の失敗のみ原因を持つ (外部には出さない)。
            cause: "cause" in error ? String(error.cause) : undefined,
          }),
        )
      : Effect.logWarning("リクエストを受け付けられませんでした").pipe(
          Effect.annotateLogs(context),
        );

  return log;
};
