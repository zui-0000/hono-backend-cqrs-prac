import { Data } from "effect";

/**
 * 認証情報が不正 (汎用 / errorCode 4010 / HTTP 401)。
 * トークン欠落・期限切れ・認証失敗などを表す。
 */
export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly message: string;
}> {}
