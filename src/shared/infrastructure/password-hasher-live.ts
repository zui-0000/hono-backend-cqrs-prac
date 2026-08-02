import { Effect, Layer } from "effect";

import { PasswordHasher } from "~/shared/services/password-hasher";

/**
 * 本番実装: Bun ネイティブの argon2id (Bun.password の既定アルゴリズム) を使う。
 * ハッシュ化は失敗しない前提 (異常時は defect) のため、エラー型は never。
 *
 * ポート (services/password-hasher.ts) と別ファイルにしているのは、
 * ポートを import する domain / application が実装まで引きずり込まないようにするため。
 * 同居させると「Bun.password を bcrypt に差し替えた」瞬間、
 * ドメインのモジュールグラフがそのライブラリに到達する。
 */
export const PasswordHasherLive = Layer.succeed(PasswordHasher, {
  hash: (plainText) => Effect.promise(() => Bun.password.hash(plainText)),
  verify: (plainText, hashed) =>
    Effect.promise(() => Bun.password.verify(plainText, hashed)),
});
