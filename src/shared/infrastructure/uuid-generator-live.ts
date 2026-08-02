import { Effect, Layer } from "effect";

import { UuidGenerator } from "~/shared/services/uuid-generator";

/**
 * 本番実装: Bun ネイティブの uuidv7 を採番する。
 *
 * ポート (services/uuid-generator.ts) と別ファイルにしている理由は
 * password-hasher-live.ts と同じ (実装の依存を利用側へ漏らさない)。
 */
export const UuidGeneratorLive = Layer.succeed(UuidGenerator, {
  next: Effect.sync(() => Bun.randomUUIDv7()),
});
