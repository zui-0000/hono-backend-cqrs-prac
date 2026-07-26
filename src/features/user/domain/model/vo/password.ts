import { Schema } from "effect";

/**
 * 平文パスワード (値オブジェクト / branded string)。12〜128 文字。
 * API 契約 (TypeSpec の Password) と同じ制約。
 *
 * NIST SP 800-63B に沿い、構成ルール (記号必須等) は課さず長さで強度を担保する。
 * この値は application 層で PasswordHasher に渡され HashedPassword になる。
 * ドメイン (User 集約) が保持することはない = 平文は境界を越えない。
 */
export const Password = Schema.String.pipe(
  Schema.minLength(12),
  Schema.maxLength(128),
  Schema.brand("User.Password"),
);
export type Password = typeof Password.Type;
