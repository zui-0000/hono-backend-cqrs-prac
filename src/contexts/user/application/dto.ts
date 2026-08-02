import { Schema } from "effect";

import { MailAddress } from "~/shared/domain/mail-address";
import { Password } from "~/shared/domain/password";

import { UserId } from "../domain/model/vo/user-id";
import { UserName } from "../domain/model/vo/user-name";

/**
 * user コンテキストのユースケース入出力 (DTO)。
 *
 * 入力と出力で作りが異なる:
 *
 * - **入力** は Effect Schema で定義する。値オブジェクトのスキーマを組み合わせるため、
 *   呼び出し側は生の入力を一度 decode するだけで検証済みの値が得られる
 *   (フィールドごとの詰め替えが不要になる)。
 *
 * - **出力** はプレーンな型で定義する。既に検証済みの値を返すだけで decode は不要だし、
 *   応答が契約を満たすかは presentation 層が生成スキーマで検証するので、
 *   ここで二重に検証しない。
 *
 * 応答ボディの「形」(`{ id: ... }` のようなラップ) は契約側の関心なので、ここには持ち込まない。
 * presentation が contract の形へ詰め替える。
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

// ---- 出力 (Command) ----

/**
 * ユーザー新規作成の結果。採番された id。
 *
 * CQRS では「コマンドは値を返さない」のが原則だが、採番した識別子は例外として返す。
 * id はサーバー側でしか決まらず、返さないとクライアントは作ったリソースを
 * 二度と参照できない (GET /users/{id} を呼べない)。集約そのものは外に出さない。
 *
 * 応答ボディの `{ id: ... }` というラップは契約側の形なので、ここでは id そのものを表す。
 * 詰め替えるのは presentation の責務。
 */
export type CreateUserCommandOutput = UserId;

// ---- 出力 (Query) ----

/**
 * getUser クエリの結果。ドメインの User 集約ではなく読み取り専用の射影で、
 * 必要になった項目だけを持たせる (集約の全項目を写さない)。
 *
 * 「UserDto」のような集約名ベースではなくユースケース名で命名するのは、
 * 一覧取得を足したときに別の射影が必要になるため
 * (どちらも「ユーザーの DTO」なので集約名では区別できない)。
 */
export type GetUserQueryOutput = {
  readonly name: string;
  readonly mailAddress: string;
};
