import { RepositoryFailure } from "~/shared/errors/repository-error";

/**
 * PostgreSQL のエラー判別ヘルパー。
 *
 * Bun.sql は PostgresError を投げ、SQLSTATE は `code` ではなく `errno` に入る
 * (`code` は "ERR_POSTGRES_SERVER_ERROR" という Bun 独自の文字列)。
 * さらに Drizzle は DrizzleQueryError でラップするため、cause を辿って判定する。
 */

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

/**
 * SQLSTATE の「クラス」(先頭 2 文字) と内訳の対応。
 *
 * 個別のコードではなくクラスで引くのは、同じクラスの中では原因の質が揃っているため
 * (08 系はどれも「繋がらない」、53 系はどれも「資源が足りない」)。
 * クラスだけでは足りないものは classifyDbFailure が先に個別判定する。
 */
const FAILURE_BY_SQL_STATE_CLASS: Readonly<
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

/**
 * SQLSTATE を持たない失敗 (サーバが応答する前に終わったもの) の分類。
 *
 * **接続できないときも例外は PostgresError だが、errno (SQLSTATE) は入らない。**
 * サーバが何も返していないのだから当然で、代わりに Bun 独自の code が付く。
 * 実際に DB を止めて確かめたところ `ERR_POSTGRES_CONNECTION_CLOSED` だった。
 * 列挙した値は bun 1.3.14 のバイナリから抽出したものを使っている。
 *
 * ここに無いものは Unknown になる。Bun 内部のプロトコル異常など、
 * 分類しても運用の判断が変わらないものは意図的に載せていない。
 */
const FAILURE_BY_ERROR_CODE: Readonly<
  Record<string, RepositoryFailure | undefined>
> = {
  // 接続が確立できない / 切れた
  ERR_POSTGRES_CONNECTION_CLOSED: RepositoryFailure.Unavailable,
  ERR_POSTGRES_CONNECTION_TIMEOUT: RepositoryFailure.Unavailable,
  ERR_POSTGRES_IDLE_TIMEOUT: RepositoryFailure.Unavailable,
  ERR_POSTGRES_LIFETIME_TIMEOUT: RepositoryFailure.Unavailable,
  ERR_POSTGRES_TLS_NOT_AVAILABLE: RepositoryFailure.Unavailable,
  ERR_POSTGRES_TLS_UPGRADE_FAILED: RepositoryFailure.Unavailable,
  // 待ちきれず打ち切った
  ERR_POSTGRES_QUERY_CANCELLED: RepositoryFailure.Timeout,
  // 接続情報や権限の誤り。DB ではなくデプロイ側の問題
  ERR_POSTGRES_AUTHENTICATION_FAILED_PBKDF: RepositoryFailure.Schema,
  ERR_POSTGRES_UNKNOWN_AUTHENTICATION_METHOD: RepositoryFailure.Schema,
  ERR_POSTGRES_UNSUPPORTED_AUTHENTICATION_METHOD: RepositoryFailure.Schema,
  ERR_POSTGRES_SYNTAX_ERROR: RepositoryFailure.Schema,
  // ドライバを介さない経路で出うる POSIX のネットワークエラー
  ECONNREFUSED: RepositoryFailure.Unavailable,
  ECONNRESET: RepositoryFailure.Unavailable,
  ENOTFOUND: RepositoryFailure.Unavailable,
  ETIMEDOUT: RepositoryFailure.Unavailable,
  EHOSTUNREACH: RepositoryFailure.Unavailable,
  EPIPE: RepositoryFailure.Unavailable,
};

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

/**
 * 例外 (ラップされている場合は cause を辿る) から、分類できる code を探す。
 * 途中に code を持たない層があっても、さらに内側を見に行く。
 */
const findKnownErrorCode = (error: unknown): string | undefined => {
  let current: unknown = error;
  while (current !== null && current !== undefined) {
    if (typeof current === "object" && "code" in current) {
      const code = (current as { code: unknown }).code;
      if (typeof code === "string" && code in FAILURE_BY_ERROR_CODE)
        return code;
    }
    if (typeof current !== "object" || !("cause" in current)) return undefined;
    current = (current as { cause: unknown }).cause;
  }
  return undefined;
};

/**
 * DB 由来の例外を、ログ用の内訳へ分類する。
 *
 * 呼ぶのは infrastructure 層だけ (RepositoryError を組み立てる箇所)。
 * 分岐のためではなくログのための情報なので、分類できなければ Unknown で構わない
 * — 外に出る応答は、どの内訳でも同じ 500 になる。
 *
 * 制約違反 (23xxx) はここへ来ない想定。来た場合は Unknown になるが、それは
 * 「ドメインのエラーへ翻訳し忘れている」というサインで、ログを見れば気付ける
 * (例: failure=unknown sqlState=23503 なら外部キー違反の扱いが抜けている)。
 */
export const classifyDbFailure = (
  error: unknown,
): { readonly failure: RepositoryFailure; readonly sqlState?: string } => {
  const postgresError = findPostgresError(error);

  if (postgresError === undefined) {
    // SQLSTATE が無い = サーバが応答する前に終わった。code で分類する。
    const code = findKnownErrorCode(error);
    return {
      failure:
        code === undefined
          ? RepositoryFailure.Unknown
          : (FAILURE_BY_ERROR_CODE[code] ?? RepositoryFailure.Unknown),
    };
  }

  const sqlState = postgresError.errno;

  // クラスで括ると質を取り違えるものだけ、先に個別で見る。
  // 57 は「管理操作」のクラスだが、57014 だけは時間切れ (statement_timeout)。
  if (sqlState === SqlState.QueryCanceled) {
    return { failure: RepositoryFailure.Timeout, sqlState };
  }

  return {
    failure:
      FAILURE_BY_SQL_STATE_CLASS[sqlState.slice(0, 2)] ??
      RepositoryFailure.Unknown,
    sqlState,
  };
};
