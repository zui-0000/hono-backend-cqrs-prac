import { RepositoryFailure } from "~/shared/errors/repository-error";

/**
 * SQLSTATE の「クラス」(先頭 2 文字) と内訳の対応。
 *
 * 個別のコードではなくクラスで引くのは、同じクラスの中では原因の質が揃っているため
 * (08 系はどれも「繋がらない」、53 系はどれも「資源が足りない」)。
 * クラスだけでは足りないものは classifyDbFailure が先に個別判定する。
 *
 * クラス分けは PostgreSQL 公式の体系そのままで、こちらが考案した分類ではない。
 * 勝手に増減しないため保守の手間がほぼかからない。
 */
export const FAILURE_BY_SQL_STATE_CLASS: Readonly<
  Record<string, RepositoryFailure | undefined>
> = {
  /** Connection Exception */
  "08": RepositoryFailure.Unavailable,
  /** Data Exception */
  "22": RepositoryFailure.Data,
  /** Transaction Rollback (serialization_failure / deadlock_detected) */
  "40": RepositoryFailure.Contention,
  /** Syntax Error or Access Rule Violation (undefined_table / insufficient_privilege) */
  "42": RepositoryFailure.Schema,
  /** Insufficient Resources (disk_full / too_many_connections) */
  "53": RepositoryFailure.Exhausted,
  /** Object Not In Prerequisite State */
  "55": RepositoryFailure.Contention,
  /** Operator Intervention (admin_shutdown / cannot_connect_now) */
  "57": RepositoryFailure.Unavailable,
};
