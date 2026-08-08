import { Context, type Effect } from "effect";

/**
 * リフレッシュトークンの発行とハッシュ化を行うサービス。
 *
 * 契約が「不透明トークン」と定めているため、券そのものに意味は持たせない。
 * 券だけ見ても誰のものか分からず、サーバ側の記録を引いて初めて意味を持つ
 * (docs/05-auth/01-our-approach.md)。
 *
 * **採番に UuidGenerator を使わない。** id は uuidv7 で統一しているが、
 * uuidv7 は時刻順に並ぶ = **次の値が推測しやすい**。券に必要なのは真逆の性質なので、
 * 暗号論的乱数から作る (同 doc「券の採番に uuidv7 を使わない」)。
 *
 * shared ではなく auth コンテキストに置くのは、**要求しているのが auth だけ**だから。
 * AccessTokenIssuer を shared に置いたのは、Bearer を検証するミドルウェアが
 * 全コンテキストのルートに掛かるためで、こちらにはその事情が無い。
 * ポートは要求する層に置く、という規約どおり (docs/02-architecture.md)。
 */
export interface RefreshTokenIssuer {
  /**
   * 新しい券を発行する。平文とハッシュを組で返すのは、
   * **平文を返す前にハッシュ化を忘れる**事故を型で防ぐため
   * (呼び出し側が別途 hash を呼ぶ形だと、忘れても動いてしまう)。
   * クライアントへ返すのは token、DB に保存するのは hash。
   */
  readonly issue: Effect.Effect<{
    readonly token: string;
    readonly hash: string;
  }>;

  /** 提示された券のハッシュを求める (保存済みの行を引き当てるため)。 */
  readonly hash: (token: string) => Effect.Effect<string>;
}
export const RefreshTokenIssuer =
  Context.GenericTag<RefreshTokenIssuer>("RefreshTokenIssuer");
