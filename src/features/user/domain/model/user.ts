import { Effect, Schema } from "effect";
import { MailAddress } from "~/shared/domain/mail-address";
import { now } from "~/shared/service/clock";
import type { UuidGenerator } from "~/shared/service/uuid-generator";
import { generateId, Id } from "./vo/id";
import { Name } from "./vo/name";
import { HashedPassword } from "./vo/hashed-password";

/**
 * User 集約ルート。
 * フレームワーク非依存の純粋なドメインモデル (Effect Schema の Struct で表現)。
 * イミュータブル: 更新関数は新しい User を返す (元の値は変わらない)。
 * 時刻・採番の副作用は Clock / UuidGenerator に委譲し、生成・更新は Effect として表す。
 *
 * 利用側は `import * as User` で読み、集約は `User.User` として参照する。
 */
export const User = Schema.Struct({
  id: Id,
  name: Name,
  mailAddress: MailAddress,
  hashedPassword: HashedPassword,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
});
export type User = typeof User.Type;

/** 新規ユーザーを生成する (id を採番し、作成/更新日時を現在時刻に)。 */
export const create = (params: {
  name: Name;
  mailAddress: MailAddress;
  hashedPassword: HashedPassword;
}): Effect.Effect<User, never, UuidGenerator> =>
  Effect.gen(function* () {
    const id = yield* generateId;
    const timestamp = yield* now;
    return {
      id,
      name: params.name,
      mailAddress: params.mailAddress,
      hashedPassword: params.hashedPassword,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

/** 名前を変更した新しい User を返す。 */
export const rename = (user: User, name: Name): Effect.Effect<User> =>
  Effect.map(now, (updatedAt) => ({ ...user, name, updatedAt }));

/** メールアドレスを変更した新しい User を返す。 */
export const changeMailAddress = (
  user: User,
  mailAddress: MailAddress,
): Effect.Effect<User> =>
  Effect.map(now, (updatedAt) => ({ ...user, mailAddress, updatedAt }));

/** パスワード (ハッシュ) を変更した新しい User を返す。 */
export const changePassword = (
  user: User,
  hashedPassword: HashedPassword,
): Effect.Effect<User> =>
  Effect.map(now, (updatedAt) => ({ ...user, hashedPassword, updatedAt }));
