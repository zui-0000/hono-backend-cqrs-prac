import { Context, Data, type Effect, type Option } from "effect";
import type { MailAddress } from "~/shared/domain/mail-address";
import type { User } from "./model/user";
import type { Id } from "./model/vo/id";

/** リポジトリ操作の失敗 (DB 接続エラー等、インフラ由来)。型付きエラー。 */
export class RepositoryError extends Data.TaggedError("UserRepositoryError")<{
  readonly cause: unknown;
}> {}

/**
 * User 集約の永続化ポート (書き込み側 / CQRS のコマンド経路)。
 * Effect のサービスとして定義 (Context.Tag)。実装 (Layer) は infrastructure 層に置く。
 * 読み取り (一覧・取得 projection) は別途 QueryService が担う。
 *
 * 名前は namespace 前提で bare (`User.Repository` / `User.RepositoryError`)。
 * ただし DI・エラーのタグ文字列はグローバル一意が要るので "UserRepository" のまま修飾。
 */
export class Repository extends Context.Tag("UserRepository")<
  Repository,
  {
    readonly create: (user: User) => Effect.Effect<void, RepositoryError>;
    readonly update: (user: User) => Effect.Effect<void, RepositoryError>;
    readonly findById: (
      id: Id,
    ) => Effect.Effect<Option.Option<User>, RepositoryError>;
    readonly findByMailAddress: (
      mailAddress: MailAddress,
    ) => Effect.Effect<Option.Option<User>, RepositoryError>;
    readonly deleteById: (id: Id) => Effect.Effect<void, RepositoryError>;
  }
>() {}
