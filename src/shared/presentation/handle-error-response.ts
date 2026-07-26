import { Effect } from "effect";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  type BadRequestError,
  type ConflictError,
  ErrorCode,
  type MailAddressAlreadyExistsError,
  type RepositoryError,
  type ResourceNotFoundError,
  type UnauthorizedError,
} from "~/shared/error";
import { type ErrorBody, errorBody } from "./response";

/**
 * presentation 層が HTTP に翻訳できるエラーの集合。
 * 検証失敗 (Effect Schema の ParseError) は validator が BadRequestError に
 * 変換するため、ライブラリ由来の型はここには現れない。
 *
 * 対応する HTTP ステータスの昇順に並べる。
 */
export type ApplicationError =
  // 400
  | BadRequestError
  // 401
  | UnauthorizedError
  // 404
  | ResourceNotFoundError
  // 409
  | ConflictError
  | MailAddressAlreadyExistsError
  // 500
  | RepositoryError;

/** HTTP 応答 (ステータスコードとボディ) 。 */
export type HttpErrorResponse = {
  readonly status: ContentfulStatusCode;
  readonly body: ErrorBody;
};

/**
 * ドメイン/アプリケーションのエラーを HTTP 応答へ翻訳する。
 * バックエンド全体のエラーハンドリングを司る唯一の窓口。
 *
 * ドメイン層は HTTP を知らないため、ステータスコードと errorCode の対応付けは
 * この境界に閉じ込める。TypeSpec で定義した契約 (errorCode 体系) と対になる。
 *
 * case はステータスコードの昇順に並べ、同じステータス内では
 * 汎用エラー (errorCode の下 1 桁が 0) を先に置く。
 */
export const handleErrorResponse = (
  error: ApplicationError,
): Effect.Effect<HttpErrorResponse> => {
  switch (error._tag) {
    // ---- 400 Bad Request ----
    // リクエストが不正 (検証違反・JSON として読めない等)。
    // 違反フィールドは validator が details に詰めている。
    case "BadRequestError":
      return errorBody({
        errorCode: ErrorCode.BadRequest,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      }).pipe(Effect.map((body) => ({ status: 400 as const, body })));

    // ---- 401 Unauthorized ----
    case "UnauthorizedError":
      return errorBody({
        errorCode: ErrorCode.Unauthorized,
        message: error.message,
      }).pipe(Effect.map((body) => ({ status: 401 as const, body })));

    // ---- 404 Not Found ----
    case "ResourceNotFoundError":
      return errorBody({
        errorCode: ErrorCode.ResourceNotFound,
        message: error.message,
      }).pipe(Effect.map((body) => ({ status: 404 as const, body })));

    // ---- 409 Conflict (汎用) ----
    case "ConflictError":
      return errorBody({
        errorCode: ErrorCode.Conflict,
        message: error.message,
      }).pipe(Effect.map((body) => ({ status: 409 as const, body })));

    // ---- 409 Conflict (メールアドレスの重複) ----
    case "MailAddressAlreadyExistsError":
      return errorBody({
        errorCode: ErrorCode.MailAddressAlreadyExists,
        message: "メールアドレスが既に使用されています",
      }).pipe(Effect.map((body) => ({ status: 409 as const, body })));

    // ---- 500 Internal Server Error ----
    // インフラ由来の失敗。原因 (cause) は外部に露出せず、ログにのみ残す。
    case "RepositoryError":
      return errorBody({
        errorCode: ErrorCode.InternalServerError,
        message: "サーバーで予期せぬエラーが発生しました",
      }).pipe(Effect.map((body) => ({ status: 500 as const, body })));
  }
};
