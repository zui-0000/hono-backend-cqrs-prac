import { Schema } from "effect";

/**
 * 平文パスワード (値オブジェクト / branded string)。12〜128 文字。
 * API 契約 (TypeSpec の Password) と同じ制約。
 *
 * NIST SP 800-63B に沿い、構成ルール (記号必須等) は課さず長さで強度を担保する。
 *
 * ユーザー登録 (users) と認証 (auth) の双方で使うため共有ドメインに置く。
 * application 層で PasswordHasher に渡してハッシュ化するための一時的な値であり、
 * 集約が保持することはない = 平文はドメインの内側に留まらない。
 */
export const Password = Schema.String.pipe(
  Schema.minLength(12),
  Schema.maxLength(128),
  Schema.brand("Password"),
);
export type Password = typeof Password.Type;
