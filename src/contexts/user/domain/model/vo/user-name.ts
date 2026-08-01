import { Schema } from "effect";

/**
 * ユーザー名 (値オブジェクト / branded string)。1〜100 文字。
 * エクスポート名は所属する集約で修飾する (UserName)。
 */
export const UserName = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(100),
  Schema.brand("User.Name"),
);
export type UserName = typeof UserName.Type;
