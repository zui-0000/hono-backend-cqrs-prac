import { Context, type Effect, Schema } from "effect";

import type { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import { Uuid } from "./model/uuid";

/**
 * アクセストークン (JWT) に載せる claims。
 *
 * **ここに書いたものは全部クライアントとネットワーク経路に晒される。**
 * JWT は署名されているだけで暗号化されていないため、payload は誰でも読める
 * (docs/05-auth/00-authentication-methods.md「JWT は暗号化されていない」)。
 * だから名前もメールアドレスも載せない。必要になったら DB から引く。
 *
 * sub と sid は役割が違う。
 * - sub: 認可の主体。「誰の」リクエストか
 * - sid: 失効の単位。「どのログインか」。同じ人が 3 台から入れば sub は同じで sid が 3 つ
 *
 * sid に載せるのは券 1 枚の id ではなく **session_id** (ローテーションを跨いで不変)。
 * 券の id を載せると、古いアクセストークンを持つタブからのログアウトが空振りする
 * (理由は docs/05-auth/01-our-approach.md「session_id を別に持つ理由」)。
 *
 * 型が branded な UserId ではなく素の Uuid なのは、shared が contexts を知らないため
 * (shared-not-to-contexts)。brand を付け直すのは受け取った側の仕事。
 */
export const AccessTokenClaims = Schema.Struct({
  sub: Uuid,
  sid: Uuid,
});
export type AccessTokenClaims = typeof AccessTokenClaims.Type;

/**
 * アクセストークンの発行と検証を行うサービス。
 *
 * 実装 (hono/jwt) は infrastructure に置く。**Bun を隠したのと同じ理由で Hono を隠す** —
 * hono は presentation の道具であって、application や domain が知ってよいものではない。
 *
 * shared に置くのは、**検証側が横断的に要るから**。発行するのは auth だけだが、
 * Bearer を検証するミドルウェアは全コンテキストのルートに掛かるため、
 * auth コンテキストの内側には置けない。
 *
 * 失敗が UnauthorizedError の 1 種類しか無いのは意図的で、期限切れ・署名不正・
 * 形式不正を書き分けない。書き分けると攻撃側に手掛かりを与える
 * (同 doc「認証失敗のメッセージを書き分けない」)。
 */
export interface AccessTokenIssuer {
  /** claims を載せた署名済みトークンを発行する (有効期限は実装が決める)。 */
  readonly issue: (claims: AccessTokenClaims) => Effect.Effect<string>;
  /** 署名と有効期限を検証し、claims を取り出す。 */
  readonly verify: (
    token: string,
  ) => Effect.Effect<AccessTokenClaims, UnauthorizedError>;
}
export const AccessTokenIssuer =
  Context.GenericTag<AccessTokenIssuer>("AccessTokenIssuer");
