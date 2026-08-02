import { Schema } from "effect";

/**
 * ハッシュ済みパスワード (値オブジェクト / 不透明な branded string)。
 * ドメインは平文を持たず、ハッシュ化・検証は application 層 (Bun.password) が担う。
 * ここは成果物であるハッシュ文字列を包む不透明な値として扱う。
 * エクスポート名は所属する集約で修飾する (UserHashedPassword)。
 */
export const UserHashedPassword = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("User.HashedPassword"),
);
export type UserHashedPassword = typeof UserHashedPassword.Type;
