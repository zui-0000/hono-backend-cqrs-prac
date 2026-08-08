import { Context, type Effect, type Option } from "effect";

import type { RepositoryError } from "~/shared/errors/repository-error";

import type { RefreshToken } from "./model/refresh-token";
import type { RefreshTokenHash } from "./model/value-objects/refresh-token-hash";
import type { SessionId } from "./model/value-objects/session-id";

/**
 * RefreshToken 集約の永続化ポート。
 *
 * user 側と同じく、更新はドメインの状態遷移と 1 対 1 に並べる
 * (docs/02-architecture.md「書き込みポートは、集約ではなく状態遷移に対応させる」)。
 * ただし auth の遷移は「1 つの集約を書き換える」形ではないものが 2 つある。
 *
 * 引き当ては**ハッシュだけ**。券の平文はサーバに残らないので、
 * findByTokenHash 以外の引き口を持ちようがない。
 */
export class RefreshTokenRepository extends Context.Tag(
  "RefreshTokenRepository",
)<
  RefreshTokenRepository,
  {
    /** 新しい券を記録する (ログイン時)。 */
    readonly create: (
      token: RefreshToken,
    ) => Effect.Effect<void, RepositoryError>;

    /** 提示された券のハッシュから行を引く。無ければ Option.none。 */
    readonly findByTokenHash: (
      tokenHash: RefreshTokenHash,
    ) => Effect.Effect<Option.Option<RefreshToken>, RepositoryError>;

    /**
     * ローテーション。**古い券の失効と新しい券の記録を 1 つの単位で行う。**
     *
     * 2 つのメソッドに分けない理由は、間で落ちるとセッションが壊れるから。
     * 失効だけ済んで発行に失敗すると、クライアントは手元の券が使えないまま
     * 新しい券も受け取れず、**再ログインするしかなくなる**。
     * ローテーションは 1 つの状態遷移なので、ポートでもそう表す (実装は 1 トランザクション)。
     */
    readonly rotate: (params: {
      readonly revoked: RefreshToken;
      readonly issued: RefreshToken;
    }) => Effect.Effect<void, RepositoryError>;

    /**
     * セッションに属する券をまとめて失効させる (ログアウト / 盗難検出)。
     *
     * 単一集約の遷移ではないが、**まとめて切ること自体が操作の単位**。
     * 1 行ずつ読んで失効させる形にすると、その間に発行された券を取りこぼす。
     *
     * 失効時刻を引数で受け取るのは、時刻を決めるのがドメイン (Clock) の側だから。
     * SQL の now() で埋めると、集約が決めた時刻と DB が打った時刻が混ざる。
     */
    readonly revokeSession: (params: {
      readonly sessionId: SessionId;
      readonly revokedAt: Date;
    }) => Effect.Effect<void, RepositoryError>;
  }
>() {}
