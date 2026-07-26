import { Data } from "effect";

/**
 * サーバー内部で予期せぬエラーが発生した (汎用 / errorCode 5000 / HTTP 500)。
 * 原因 (cause) は外部に露出せず、ログ等の内部利用に留める。
 */
export class InternalServerError extends Data.TaggedError(
  "InternalServerError",
)<{
  readonly cause: unknown;
}> {}
