import { Effect, Schema } from "effect";

import { MailAddress } from "~/shared/domain/value-objects/mail-address";
import type { Password } from "~/shared/domain/value-objects/password";
import { UnauthorizedError } from "~/shared/errors/unauthorized-error";
import { now } from "~/shared/services/clock";
import { PasswordHasher } from "~/shared/services/password-hasher";
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

/**
 * 渡された平文が、このユーザーの現在のパスワードであることを確かめる。
 * 一致しなければ UnauthorizedError (401) で失敗する。
 *
 * **ドメインサービスではなく集約に置いている。** 「同じメールアドレスの人が他に
 * 居るか」と違って、この問いは User 集約 1 つを見れば答えが出るため、
 * 集約に属さない操作の受け皿であるドメインサービスの条件を満たさない。
 *
 * 一方でユースケースの方針 (404 の扱いなど) でもない。
 * 「パスワード変更のとき現在のパスワードを確認するか」はビジネス側に聞ける問い
 * (確認せず再ログインを求める製品もある) なので、業務ルールとして内側に置く。
 *
 * ハッシュ照合という副作用が要るが、依存するのは shared/services のポートだけで
 * 実装 (Bun.password) は知らない。createUser が UuidGenerator を、
 * changeUserProfile が Clock を要求するのと同じ形で R に現れる。
 */
export const verifyUserPassword = (
  user: User,
  plainText: Password,
): Effect.Effect<void, UnauthorizedError, PasswordHasher> =>
  Effect.gen(function* () {
    const passwordHasher = yield* PasswordHasher;
    const matched = yield* passwordHasher.verify(
      plainText,
      user.hashedPassword,
    );
    if (!matched) {
      return yield* new UnauthorizedError();
    }
  });

/**
 * パスワードを変更した集約を返す (changeUserProfile と同じくイミュータブル)。
 *
 * 受け取るのはハッシュ済みの値だけで、平文も本人確認もここには現れない。
 * 照合は verifyUserPassword、ハッシュ化は application 層の責務で、
 * この関数は「状態がどう変わるか」だけを担う
 * (ドメインは平文を持たない、という値オブジェクトの取り決めがそのまま効く)。
 */
export const changeUserPassword = (
  user: User,
  hashedPassword: UserHashedPassword,
): Effect.Effect<User> =>
  now.pipe(
    Effect.map((timestamp) => ({
      ...user,
      hashedPassword,
      updatedAt: timestamp,
    })),
  );
