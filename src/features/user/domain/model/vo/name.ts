import { Schema } from "effect";

/**
 * ユーザー名 (値オブジェクト / branded string)。1〜100 文字。
 * 利用側は `User.Name` として参照する。brand タグは "User.Name" と修飾。
 */
export const Name = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(100),
  Schema.brand("User.Name"),
);
export type Name = typeof Name.Type;
