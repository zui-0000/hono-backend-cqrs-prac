import { Data } from "effect";

/**
 * リポジトリ操作の失敗 (DB 接続エラー等、インフラ由来)。
 * ドメイン/ユースケースの失敗ではないため、presentation 層では
 * InternalServerError (5000 / HTTP 500) に翻訳する。
 */
export class RepositoryError extends Data.TaggedError("RepositoryError")<{
  readonly cause: unknown;
}> {}
