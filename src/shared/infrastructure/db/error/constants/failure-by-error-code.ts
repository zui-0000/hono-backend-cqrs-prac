import { RepositoryFailure } from "~/shared/errors/repository-error";

/**
 * SQLSTATE を持たない失敗 (サーバが応答する前に終わったもの) の分類。
 *
 * **接続できないときも例外は PostgresError だが、errno (SQLSTATE) は入らない。**
 * サーバが何も返していないのだから当然で、代わりに Bun 独自の code が付く。
 * 実際に DB を止めて確かめたところ `ERR_POSTGRES_CONNECTION_CLOSED` だった。
 * 列挙した値は bun 1.3.14 のバイナリから抽出したものを使っている。
 *
 * 上の表 (SQLSTATE のクラス) と違い、こちらは **Bun の実装に依存する**。
 * Bun を上げたときに増減しうるので、接続断の分類が Unknown に落ちたらここを疑う。
 *
 * ここに無いものは Unknown になる。Bun 内部のプロトコル異常など、
 * 分類しても運用の判断が変わらないものは意図的に載せていない。
 */
export const FAILURE_BY_ERROR_CODE: Readonly<
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
