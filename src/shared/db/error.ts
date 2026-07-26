/**
 * PostgreSQL のエラー判別ヘルパー。
 *
 * Bun.sql は PostgresError を投げ、SQLSTATE は `code` ではなく `errno` に入る
 * (`code` は "ERR_POSTGRES_SERVER_ERROR" という Bun 独自の文字列)。
 * さらに Drizzle は DrizzleQueryError でラップするため、cause を辿って判定する。
 */

/** PostgreSQL の SQLSTATE (使うものだけ)。 */
export const SqlState = {
  /** 一意制約違反 */
  UniqueViolation: "23505",
  /** 外部キー制約違反 */
  ForeignKeyViolation: "23503",
  /** NOT NULL 制約違反 */
  NotNullViolation: "23502",
  /** 検査制約違反 */
  CheckViolation: "23514",
} as const;

export type SqlState = (typeof SqlState)[keyof typeof SqlState];

/** PostgresError のうち、判定に使うフィールド。 */
type PostgresErrorLike = {
  readonly errno: string;
  readonly constraint?: string;
  readonly table?: string;
  readonly detail?: string;
};

const isPostgresErrorLike = (value: unknown): value is PostgresErrorLike =>
  typeof value === "object" &&
  value !== null &&
  "errno" in value &&
  typeof (value as { errno: unknown }).errno === "string";

/**
 * 例外 (ラップされている場合は cause を辿る) から PostgresError を取り出す。
 * 見つからなければ undefined。
 */
export const findPostgresError = (
  error: unknown,
): PostgresErrorLike | undefined => {
  let current: unknown = error;
  // DrizzleQueryError → PostgresError のように cause で包まれるため辿る。
  while (current !== null && current !== undefined) {
    if (isPostgresErrorLike(current)) return current;
    if (typeof current !== "object" || !("cause" in current)) return undefined;
    current = (current as { cause: unknown }).cause;
  }
  return undefined;
};

/**
 * 指定の SQLSTATE 違反かどうかを判定する。
 * constraint を渡した場合はその制約名に一致するものだけを対象にする。
 */
export const isSqlStateViolation = (
  error: unknown,
  sqlState: SqlState,
  constraint?: string,
): boolean => {
  const postgresError = findPostgresError(error);
  if (postgresError === undefined) return false;
  if (postgresError.errno !== sqlState) return false;
  return constraint === undefined || postgresError.constraint === constraint;
};
