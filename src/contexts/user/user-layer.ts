import { Layer } from "effect";

import { GetUserQueryServiceLive } from "./infrastructure/get-user-query-service-live";
import { UserRepositoryLive } from "./infrastructure/user-repository-live";

/**
 * user コンテキストが提供する実装 (アダプタ) を束ねた Layer。
 *
 * 合成ルート (`src/app-runtime.ts`) はこれ 1 つを取り込めばよく、
 * アダプタが増えても合成ルートは変わらない
 * (app.ts が `app.route("/users", ...)` の 1 行で済むのと同じ形)。
 *
 * ここは **コンテキスト内の実装を知ってよい唯一の場所**。だから
 * infrastructure を直接 import している。逆に「このコンテキストが何を要求するか」
 * (`UserRuntime`) は presentation 側に置く — そちらはポートしか知ってはならず、
 * 同じファイルに同居させると要求側から実装への経路ができてしまうため。
 *
 * 横断サービス (PasswordHasher / UuidGenerator) はここには含めない。
 * user コンテキストが所有するものではなく、合成ルートが shared から供給する。
 */
export const UserLayer = Layer.mergeAll(
  UserRepositoryLive,
  GetUserQueryServiceLive,
);
