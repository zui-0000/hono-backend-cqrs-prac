import { Layer } from "effect";

import { RefreshTokenIssuerLive } from "./infrastructure/refresh-token-issuer-live";
import { RefreshTokenRepositoryLive } from "./infrastructure/refresh-token-repository-live";

/**
 * auth コンテキストが提供する実装 (アダプタ) を束ねた Layer。
 *
 * ここは **コンテキスト内の実装を知ってよい唯一の場所**。だから
 * infrastructure を直接 import している。逆に「このコンテキストが何を要求するか」
 * (`AuthRuntime`) は presentation 側に置く。
 *
 * AccessTokenIssuer はここに含めない。auth が所有するものではなく、
 * Bearer の検証で全コンテキストが使うため、合成ルートが shared から供給する
 * (PasswordHasher / UuidGenerator と同じ扱い)。
 */
export const AuthLayer = Layer.mergeAll(
  RefreshTokenRepositoryLive,
  RefreshTokenIssuerLive,
);
