import { Layer } from "effect";

import { GetUserQueryServiceLive } from "./infrastructure/get-user-query-service-live";
import { UserRepositoryLive } from "./infrastructure/user-repository-live";
import { VerifyCredentialsQueryServiceLive } from "./infrastructure/verify-credentials-query-service-live";

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
  // auth からの要求に応えて公開している面 (Customer/Supplier)。
  // 内側で UserRepository を使うので、自分のコンテキストのものをここで供給する。
  // PasswordHasher は横断サービスなので供給せず、要求として合成ルートへ預ける
  // (この Layer の RIn に現れる)。
  VerifyCredentialsQueryServiceLive.pipe(Layer.provide(UserRepositoryLive)),
);
