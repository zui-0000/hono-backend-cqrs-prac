import { Data } from "effect";

/**
 * 認証情報が不正 (汎用 / errorCode 4010 / HTTP 401)。
 * トークン欠落・期限切れ・パスワード不一致などを表す。
 *
 * ResourceNotFoundError と同じく message を持たない。文言を決めるのは
 * presentation の責務で (handle-error-response.ts が ErrorMessage.Unauthorized を
 * 割り当てる)、ドメインが API の文言を抱えずに済む。
 *
 * 認証の失敗はとくに文言を分けてはいけない種類のエラーでもある。
 * 「利用者が居ない」と「パスワードが違う」を書き分けると、
 * 総当たりで利用者の存在を判定されてしまう。
 */
export class UnauthorizedError extends Data.TaggedError(
  "UnauthorizedError",
)<{}> {}
