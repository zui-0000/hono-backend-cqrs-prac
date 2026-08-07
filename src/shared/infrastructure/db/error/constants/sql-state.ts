/**
 * PostgreSQL の SQLSTATE (使うものだけ)。
 * 値は公式の Appendix A (Error Codes) と照合済み。
 *
 * 制約違反 (23xxx) だけは扱いが違う。あれは業務ルールの違反が DB で顕在化したもので、
 * isSqlStateViolation で個別に判定してドメインのエラーへ翻訳する。
 * それ以外は classifyDbFailure がログ用の内訳へ丸める。
 */
export const SqlState = {
  /** 一意制約違反 */
  UniqueViolation: "23505",
  /** 外部キー制約違反 */
  ForeignKeyViolation: "23503",
  /** NOT NULL 制約違反 */
  NotNullViolation: "23502",
  /** 検査制約違反 */
  CheckViolation: "23514",
  /** クエリの中断 (statement_timeout など) */
  QueryCanceled: "57014",
  /** ロックが取れない (NOWAIT 指定時など) */
  LockNotAvailable: "55P03",
} as const;

export type SqlState = (typeof SqlState)[keyof typeof SqlState];
