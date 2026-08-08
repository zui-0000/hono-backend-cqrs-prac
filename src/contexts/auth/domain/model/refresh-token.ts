import { Effect, Option, Schema } from "effect";

import { UserId } from "~/contexts/user/domain/model/value-objects/user-id";
import { now } from "~/shared/domain/clock";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";

import { RefreshTokenHash } from "./value-objects/refresh-token-hash";
import {
  generateRefreshTokenId,
  RefreshTokenId,
} from "./value-objects/refresh-token-id";
import { SessionId } from "./value-objects/session-id";

/**
 * リフレッシュトークンの寿命。長命側なので日単位。
 * これを過ぎたら再ログインが要る (docs/05-auth/01-our-approach.md「決めた値」)。
 */
const TTL_MILLIS = 14 * 24 * 60 * 60 * 1000;

/**
 * ローテーション直後、古い券を受け付け続ける猶予。
 *
 * **これが無いとローテーションが正規利用者を締め出す。** アクセストークンが切れた瞬間に
 * 複数のタブが同時に更新を投げると、先頭以外は「失効済みの券」を提示することになり、
 * 盗難と誤検出される。守るための仕組みが守るべき相手を締め出す形で、
 * セキュリティ機能の失敗はだいたいこれ。
 */
const GRACE_PERIOD_MILLIS = 30 * 1000;

/**
 * リフレッシュトークン集約。**1 行 = 券 1 枚**で、ローテーションのたびに新しい行になる。
 *
 * 保持するのは券そのものではなくハッシュ。イミュータブルで、失効も
 * 「revokedAt を持つ新しい値を返す」形で表す (User 集約と同じ作法)。
 *
 * userId が user コンテキストの branded な UserId なのは、**同じ識別子だから**。
 * auth 側で素の Uuid として持つと、user の id との対応が型から消える。
 * 境界ルールが禁じているのは他コンテキストの infrastructure / presentation への
 * 参照であって、domain (ポートと語彙) は参照してよい。
 * これが auth → user という Customer/Supplier の関係を、モジュールグラフに現す。
 *
 * revokedAt を Option にしているのは、DB の NULL をそのまま扱わないため。
 * Encoded 側は `Date | null` なので、行をそのまま decode できる形は保たれている。
 */
export const RefreshToken = Schema.Struct({
  id: RefreshTokenId,
  sessionId: SessionId,
  tokenHash: RefreshTokenHash,
  userId: UserId,
  expiresAt: Schema.DateFromSelf,
  revokedAt: Schema.OptionFromNullOr(Schema.DateFromSelf),
  createdAt: Schema.DateFromSelf,
});
export type RefreshToken = typeof RefreshToken.Type;

/**
 * 提示された券の状態。refresh の分岐はこれだけで決まる。
 *
 * 「失効しているか」を真偽値で返さないのは、**失効の理由で扱いが変わる**から。
 * 猶予期間の内と外では意味が正反対で、内は並行更新 (正規)、外は再利用 (盗難のサイン)。
 */
export const RefreshTokenState = {
  /** 使える。通常のローテーションへ進む */
  Usable: "usable",
  /** 失効済みだが猶予期間の内。並行更新とみなして同じく進む */
  WithinGrace: "within-grace",
  /** 失効済みで猶予期間の外。**盗難のサイン** */
  Reused: "reused",
  /** 期限切れ。再ログインが要る */
  Expired: "expired",
} as const;

export type RefreshTokenState =
  (typeof RefreshTokenState)[keyof typeof RefreshTokenState];

/**
 * 新しい券を発行する (ログイン時と、ローテーションのたび)。
 *
 * sessionId を引数で受け取るのは、**ローテーションでは据え置き、ログインでは新規**と
 * 呼び出し側で変わるため。ここで採番すると更新のたびにセッションが切れてしまう。
 *
 * tokenHash も引数。券そのものを作るのは RefreshTokenIssuer の仕事で、
 * ドメインは「発行された券のハッシュ」しか受け取らない (平文を持たない)。
 */
export const issueRefreshToken = (params: {
  readonly userId: UserId;
  readonly sessionId: SessionId;
  readonly tokenHash: RefreshTokenHash;
}): Effect.Effect<RefreshToken, never, UuidGenerator> =>
  Effect.all([generateRefreshTokenId, now], {
    concurrency: "unbounded",
  }).pipe(
    Effect.map(([id, timestamp]) => ({
      id,
      sessionId: params.sessionId,
      tokenHash: params.tokenHash,
      userId: params.userId,
      expiresAt: new Date(timestamp.getTime() + TTL_MILLIS),
      revokedAt: Option.none(),
      createdAt: timestamp,
    })),
  );

/**
 * 失効させた券を返す (元の値は書き換えない)。
 * 行を消さず時刻で印を付けるのは、**再利用を検出するため**。
 * 消すと「盗まれた券の再利用」と「知らない券」が区別できなくなる。
 */
export const revokeRefreshToken = (
  token: RefreshToken,
): Effect.Effect<RefreshToken> =>
  now.pipe(
    Effect.map((timestamp) => ({
      ...token,
      revokedAt: Option.some(timestamp),
    })),
  );

/**
 * 券がいまどの状態かを判定する。
 *
 * 期限切れを先に見るのは、**期限切れの券の再利用を盗難扱いしない**ため。
 * 期限が切れていれば攻撃者が使っても何も得られず、一方で 2 週間ぶりに開いた
 * 正規のクライアントが誤検出されるほうが実害が大きい。
 */
export const classifyRefreshToken = (
  token: RefreshToken,
): Effect.Effect<RefreshTokenState> =>
  now.pipe(
    Effect.map((at) => {
      if (token.expiresAt.getTime() <= at.getTime()) {
        return RefreshTokenState.Expired;
      }
      return Option.match(token.revokedAt, {
        onNone: () => RefreshTokenState.Usable,
        onSome: (revokedAt) =>
          at.getTime() - revokedAt.getTime() <= GRACE_PERIOD_MILLIS
            ? RefreshTokenState.WithinGrace
            : RefreshTokenState.Reused,
      });
    }),
  );
