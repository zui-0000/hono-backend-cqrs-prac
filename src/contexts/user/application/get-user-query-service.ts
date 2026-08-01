import { Context, type Effect, type Option } from "effect";

import type { RepositoryError } from "~/shared/error/repository-error";

import type { UserDto } from "./dto";

/**
 * ユーザー取得クエリのポート (読み取り側 / CQRS のクエリ経路)。
 *
 * ポートを domain ではなく application に置くのは、読み取りがドメインの関心事では
 * ないから。書き込みは集約の不変条件を守るため domain の UserRepository を通すが、
 * 読み取りはビジネスルールの強制が不要なので、集約を復元せず DTO を直接返す。
 *
 * 結果として依存経路も非対称になる:
 *   Command: presentation → application → domain → infrastructure
 *   Query  : presentation → application → infrastructure (domain を経由しない)
 *
 * 実装 (SQL を書く Layer) は infrastructure 層に置く。
 */
export interface GetUserQueryService {
  /** id でユーザーを取得する (存在しなければ Option.none)。 */
  readonly execute: (
    id: string,
  ) => Effect.Effect<Option.Option<UserDto>, RepositoryError>;
}
export const GetUserQueryService = Context.GenericTag<GetUserQueryService>(
  "GetUserQueryService",
);
