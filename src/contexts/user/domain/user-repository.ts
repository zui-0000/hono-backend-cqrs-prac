import { Context, type Effect, type Option } from "effect";

import type { MailAddress } from "~/shared/domain/mail-address";
import type { MailAddressAlreadyExistsError } from "~/shared/error/mail-address-already-exists-error";
import type { RepositoryError } from "~/shared/error/repository-error";

import type { User } from "./model/user";
import type { UserId } from "./model/vo/user-id";

/**
 * User 集約の永続化ポート (書き込み側 / CQRS のコマンド経路)。
 * Effect のサービスとして定義 (Context.Tag)。実装 (Layer) は infrastructure 層に置く。
 * 読み取り (一覧・取得 projection) は別途 QueryService が担う。
 */
export class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  {
    readonly create: (
      user: User,
    ) => Effect.Effect<void, MailAddressAlreadyExistsError | RepositoryError>;
    readonly update: (
      user: User,
    ) => Effect.Effect<void, MailAddressAlreadyExistsError | RepositoryError>;
    readonly findById: (
      id: UserId,
    ) => Effect.Effect<Option.Option<User>, RepositoryError>;
    readonly findByMailAddress: (
      mailAddress: MailAddress,
    ) => Effect.Effect<Option.Option<User>, RepositoryError>;
    readonly deleteById: (id: UserId) => Effect.Effect<void, RepositoryError>;
  }
>() {}
