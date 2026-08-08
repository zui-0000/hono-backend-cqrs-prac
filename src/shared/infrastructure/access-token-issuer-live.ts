import { Clock, Config, Effect, Layer, Redacted, Schema } from "effect";
import { sign, verify } from "hono/jwt";

import {
  AccessTokenClaims,
  AccessTokenIssuer,
} from "~/shared/domain/access-token-issuer";
import { UnauthorizedError } from "~/shared/errors/unauthorized-error";

/**
 * 署名アルゴリズム。発行と検証が同じプロセスで完結するため対称鍵で足りる。
 * 非対称 (RS256 等) が要るのは、検証だけ別サービスに任せるとき。
 */
const ALGORITHM = "HS256";

/**
 * アクセストークンの寿命 (秒)。短いほどログアウトの即時性が上がるが、
 * そのぶん更新の頻度＝ DB アクセスが増える。15 分はその釣り合いで決めた値
 * (docs/05-auth/01-our-approach.md「決めた値」)。
 */
const TTL_SECONDS = 15 * 60;

/**
 * HS256 の鍵として最低限求める長さ。
 *
 * 未設定を弾くだけでは足りない。**短い鍵は総当たりで割られる**うえ、
 * 割られても「正常に動いているように見える」ため気付けない。
 * HMAC-SHA256 の出力と同じ 256 bit ぶん (16 進で 64 文字、任意文字なら 32 文字) を下限にする。
 */
const MINIMUM_SECRET_LENGTH = 32;

/**
 * 本番実装。hono/jwt で署名・検証する (追加の依存は要らない)。
 *
 * 鍵は Config 経由で読むので、未設定なら Layer の構築時点で落ちる。
 * ここを非 null 断言で済ませると **空の鍵で署名し続け、誰でも偽造できるトークンを
 * 発行しながら正常に見える**。DatabaseLive と同じく、依存を揃えられないなら
 * 起動しないのが正しいので orDie で defect にする。
 */
export const AccessTokenIssuerLive = Layer.effect(
  AccessTokenIssuer,
  Effect.gen(function* () {
    const secret = Redacted.value(yield* Config.redacted("JWT_SECRET"));

    if (secret.length < MINIMUM_SECRET_LENGTH) {
      return yield* Effect.die(
        new Error(
          `JWT_SECRET が短すぎます (${secret.length} 文字)。` +
            `${MINIMUM_SECRET_LENGTH} 文字以上にしてください。`,
        ),
      );
    }

    return {
      issue: (claims) =>
        Clock.currentTimeMillis.pipe(
          Effect.flatMap((millis) => {
            const issuedAt = Math.floor(millis / 1000);
            return Effect.promise(() =>
              sign(
                { ...claims, iat: issuedAt, exp: issuedAt + TTL_SECONDS },
                secret,
                ALGORITHM,
              ),
            );
          }),
        ),

      // hono/jwt の verify は期限切れも署名不正も例外で返す。どれも同じ 401 に丸め、
      // 失敗の理由は外に出さない。claims の形が違うものも同様 (decode 失敗 = 不正な券)。
      verify: (token) =>
        Effect.tryPromise({
          try: () => verify(token, secret, ALGORITHM),
          catch: () => new UnauthorizedError(),
        }).pipe(
          Effect.flatMap((payload) =>
            Schema.decodeUnknown(AccessTokenClaims)(payload).pipe(
              Effect.mapError(() => new UnauthorizedError()),
            ),
          ),
        ),
    };
  }),
).pipe(Layer.orDie);
