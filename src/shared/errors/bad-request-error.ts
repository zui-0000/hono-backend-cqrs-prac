import { Data } from "effect";

import type { ErrorDetail } from "./error-detail";

/**
 * リクエスト内容が不正 (汎用 / errorCode 4000 / HTTP 400)。
 * 入力値の検証失敗などを表す。
 */
export class BadRequestError extends Data.TaggedError("BadRequestError")<{
  readonly message: string;
  readonly details?: readonly ErrorDetail[];
}> {}
