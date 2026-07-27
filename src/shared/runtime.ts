import { Layer, ManagedRuntime } from "effect";
import { UserRepositoryLive } from "~/features/user/infrastructure/user-repository";
import { PasswordHasherLive } from "~/shared/service/password-hasher";
import { UuidGeneratorLive } from "~/shared/service/uuid-generator";

/**
 * アプリケーション全体の依存 (Layer) を組み立てたもの。
 * ポートに対する本番アダプタをここで一箇所に集約する。
 */
export const AppLayer = Layer.mergeAll(
  UserRepositoryLive,
  PasswordHasherLive,
  UuidGeneratorLive,
);

/**
 * 起動時に一度だけ Layer を構築して使い回すランタイム。
 * presentation 層 (Hono ハンドラ) はこの runtime で Effect を実行する。
 */
export const runtime = ManagedRuntime.make(AppLayer);
