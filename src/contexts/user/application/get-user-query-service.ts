import { Context, type Effect, type Option } from "effect";

import type { RepositoryError } from "~/shared/errors/repository-error";

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
  ) => Effect.Effect<Option.Option<GetUserQueryOutput>, RepositoryError>;
}
export const GetUserQueryService = Context.GenericTag<GetUserQueryService>(
  "GetUserQueryService",
);
