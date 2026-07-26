import { Context, type Effect, type Option } from "effect";
import type { MailAddress } from "~/shared/domain/mail-address";
import type {
  MailAddressAlreadyExistsError,
  RepositoryError,
} from "~/shared/error";
import type { User } from "./model/user";
import type { Id } from "./model/vo/id";

/**
 * User 集約の永続化ポート (書き込み側 / CQRS のコマンド経路)。
 * Effect のサービスとして定義 (Context.Tag)。実装 (Layer) は infrastructure 層に置く。
 * 読み取り (一覧・取得 projection) は別途 QueryService が担う。
 *
 * 名前は namespace 前提で bare (`User.Repository`)。
 * ただし DI のタグ文字列はグローバル一意が要るので "UserRepository" と修飾。
 * 失敗は共有のエラーカタログ (shared/error) の RepositoryError を使う。
 */
export class Repository extends Context.Tag("UserRepository")<
  Repository,
  {
    /** 新規作成。メールアドレスの一意制約違反は MailAddressAlreadyExistsError に翻訳される。 */
    readonly create: (
      user: User,
    ) => Effect.Effect<void, MailAddressAlreadyExistsError | RepositoryError>;
    /** 更新。メールアドレスの一意制約違反は MailAddressAlreadyExistsError に翻訳される。 */
    readonly update: (
      user: User,
    ) => Effect.Effect<void, MailAddressAlreadyExistsError | RepositoryError>;
    readonly findById: (
      id: Id,
    ) => Effect.Effect<Option.Option<User>, RepositoryError>;
    readonly findByMailAddress: (
      mailAddress: MailAddress,
    ) => Effect.Effect<Option.Option<User>, RepositoryError>;
    readonly deleteById: (id: Id) => Effect.Effect<void, RepositoryError>;
  }
>() {}
