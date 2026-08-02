import { Effect, Schema } from "effect";

import { MailAddress } from "~/shared/domain/value-objects/mail-address";
import { now } from "~/shared/services/clock";
import type { UuidGenerator } from "~/shared/services/uuid-generator";

import { UserHashedPassword } from "./value-objects/user-hashed-password";
import { generateUserId, UserId } from "./value-objects/user-id";
import { UserName } from "./value-objects/user-name";

/**
 * User 集約ルート。
 * フレームワーク非依存の純粋なドメインモデル (Effect Schema の Struct で表現)。
 * イミュータブル: 値を書き換えず、状態を変える操作は新しい User を返す。
 * 時刻・採番の副作用は Clock / UuidGenerator に委譲し、生成は Effect として表す。
 *
 * バレル (index.ts) を置かない方針のため、エクスポート名はそれ自体で
 * 何の集約かが分かる形にする (Model ではなく User、create ではなく createUser)。
 */
export const User = Schema.Struct({
  id: UserId,
  name: UserName,
  mailAddress: MailAddress,
  hashedPassword: UserHashedPassword,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
});
export type User = typeof User.Type;

/**
 * 新規ユーザーを生成する (id を採番し、作成/更新日時を現在時刻に)。
 * 採番と時刻取得は互いに独立しているため Effect.all で並行に取得する。
 */
export const createUser = (params: {
  name: UserName;
  mailAddress: MailAddress;
  hashedPassword: UserHashedPassword;
}): Effect.Effect<User, never, UuidGenerator> =>
  Effect.all([generateUserId, now], { concurrency: "unbounded" }).pipe(
    Effect.map(([id, timestamp]) => ({
      id,
      name: params.name,
      mailAddress: params.mailAddress,
      hashedPassword: params.hashedPassword,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );

/**
 * プロフィール (名前・メールアドレス) を変更した集約を返す。
 *
 * 元の User は書き換えず、更新後の値と新しい updatedAt を持つ別の User を返す
 * (イミュータブルな状態遷移)。呼び出し側が古い集約を握り続けても、
 * 意図せず変更が波及しない。
 *
 * API 契約が PUT (対象項目をすべて送る全置換) なので、部分更新ではなく
 * 「変更後の値で差し替える」操作として表現する。
 * id / createdAt / hashedPassword は変わらないため引数に取らない
 * (パスワード変更は本人確認を伴う別の操作)。
 */
export const changeUserProfile = (
  user: User,
  params: { name: UserName; mailAddress: MailAddress },
): Effect.Effect<User> =>
  now.pipe(
    Effect.map((timestamp) => ({
      ...user,
      name: params.name,
      mailAddress: params.mailAddress,
      updatedAt: timestamp,
    })),
  );
