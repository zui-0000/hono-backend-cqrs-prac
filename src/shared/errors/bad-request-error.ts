import { Data } from "effect";

/** エラーの詳細 (フィールド単位の指摘)。TypeSpec の ErrorDetail と対応。 */
export type ErrorDetail = {
  readonly field: string;
  readonly message: string;
};

/**
 * リクエスト内容が不正 (汎用 / errorCode 4000 / HTTP 400)。
 * 入力値の検証失敗などを表す。
 */
export class BadRequestError extends Data.TaggedError("BadRequestError")<{
  readonly message: string;
  readonly details?: readonly ErrorDetail[];
}> {}
