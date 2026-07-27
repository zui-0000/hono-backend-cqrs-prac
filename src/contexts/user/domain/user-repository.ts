import { Context, type Effect, type Option } from "effect";
import type { MailAddress } from "~/shared/domain/mail-address";
import type {
  MailAddressAlreadyExistsError,
  RepositoryError,
} from "~/shared/error";
import type { Model } from "./model/user";
import type { Id } from "./model/vo/id";

/**
 * User 集約の永続化ポート (書き込み側 / CQRS のコマンド経路)。
 * Effect のサービスとして定義 (Context.Tag)。実装 (Layer) は infrastructure 層に置く。
 * 読み取り (一覧・取得 projection) は別途 QueryService が担う。
 */
export class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  {
    readonly create: (
      user: Model,
    ) => Effect.Effect<void, MailAddressAlreadyExistsError | RepositoryError>;
    readonly update: (
      user: Model,
    ) => Effect.Effect<void, MailAddressAlreadyExistsError | RepositoryError>;
    readonly findById: (
      id: Id,
    ) => Effect.Effect<Option.Option<Model>, RepositoryError>;
    readonly findByMailAddress: (
      mailAddress: MailAddress,
    ) => Effect.Effect<Option.Option<Model>, RepositoryError>;
    readonly deleteById: (id: Id) => Effect.Effect<void, RepositoryError>;
  }
>() {}
