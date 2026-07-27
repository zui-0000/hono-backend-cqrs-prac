import { Schema } from "effect";
import { MailAddress } from "~/shared/domain/mail-address";
import { Password } from "~/shared/domain/password";
import * as User from "../domain/model";

/**
 * user コンテキストのユースケース入出力 (DTO)。
 *
 * 入力 (Command) と出力 (Query) で作りが異なる:
 *
 * - **入力** は Effect Schema で定義する。値オブジェクトのスキーマを組み合わせるため、
 *   呼び出し側は生の入力を一度 decode するだけで検証済みの値が得られる
 *   (フィールドごとの詰め替えが不要になる)。
 *
 * - **出力** はプレーンな型で定義する。Query 側はドメインを経由せず
 *   (集約を復元せず) SQL の結果をそのまま画面向けの形で返すため、
 *   brand も decode も不要。応答が契約を満たすかは presentation 層が
 *   生成スキーマで検証するので、ここで二重に検証しない。
 */

// ---- 入力 (Command) ----

/** ユーザー新規作成の入力。 */
export const CreateUserCommandInput = Schema.Struct({
  name: User.Name,
  mailAddress: MailAddress,
  password: Password,
});
export type CreateUserCommandInput = typeof CreateUserCommandInput.Type;

// ---- 出力 (Query) ----

/**
 * ユーザー取得の結果。ドメインの User 集約ではなく読み取り専用の射影。
 * 必要になった項目だけを持たせる (集約の全項目を写さない)。
 */
export type UserDto = {
  readonly name: string;
  readonly mailAddress: string;
};
