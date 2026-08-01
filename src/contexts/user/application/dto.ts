import { Schema } from "effect";
import { MailAddress } from "~/shared/domain/mail-address";
import { Password } from "~/shared/domain/password";
import { UserId } from "../domain/model/vo/user-id";
import { UserName } from "../domain/model/vo/user-name";

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
  name: UserName,
  mailAddress: MailAddress,
  password: Password,
});
export type CreateUserCommandInput = typeof CreateUserCommandInput.Type;

/**
 * ユーザー更新の入力。
 * id はパスパラメータ、それ以外はボディ由来だが、ユースケースから見れば
 * 入力は 1 つなので合成した形で定義する (組み立ては presentation 層の責務)。
 */
export const UpdateUserCommandInput = Schema.Struct({
  id: UserId,
  name: UserName,
  mailAddress: MailAddress,
});
export type UpdateUserCommandInput = typeof UpdateUserCommandInput.Type;

/**
 * ユーザー削除の入力。項目が id だけでも Struct で定義するのは、
 * 生成スキーマの UserId (API 契約の brand) をドメインの UserId へ
 * 変換する経路を、他のコマンドと同じ形に揃えるため。
 */
export const DeleteUserCommandInput = Schema.Struct({
  id: UserId,
});
export type DeleteUserCommandInput = typeof DeleteUserCommandInput.Type;

// ---- 出力 (Query) ----

/**
 * ユーザー取得の結果。ドメインの User 集約ではなく読み取り専用の射影。
 * 必要になった項目だけを持たせる (集約の全項目を写さない)。
 */
export type UserDto = {
  readonly name: string;
  readonly mailAddress: string;
};
