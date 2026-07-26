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
 * イミュータブル: 値を書き換えず、状態を変える操作は新しい Model を返す。
 * 時刻・採番の副作用は Clock / UuidGenerator に委譲し、生成は Effect として表す。
 *
 * 利用側は `import * as User` で読み、集約は `User.Model` として参照する。
 */
export const Model = Schema.Struct({
  id: Id,
  name: Name,
  mailAddress: MailAddress,
  hashedPassword: HashedPassword,
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
});
export type Model = typeof Model.Type;

/**
 * 新規ユーザーを生成する (id を採番し、作成/更新日時を現在時刻に)。
 * 採番と時刻取得は互いに独立しているため Effect.all で並行に取得する。
 */
export const create = (params: {
  name: Name;
  mailAddress: MailAddress;
  hashedPassword: HashedPassword;
}): Effect.Effect<Model, never, UuidGenerator> =>
  Effect.all([generateId, now], { concurrency: "unbounded" }).pipe(
    Effect.map(([id, timestamp]) => ({
      id,
      name: params.name,
      mailAddress: params.mailAddress,
      hashedPassword: params.hashedPassword,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  );
