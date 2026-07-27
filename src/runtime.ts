import { Layer, type ManagedRuntime } from "effect";
import { UserRepositoryLive } from "~/features/user/infrastructure/user-repository";
import { PasswordHasherLive } from "~/shared/service/password-hasher";
import { UuidGeneratorLive } from "~/shared/service/uuid-generator";

/**
 * アプリケーションの合成ルート (composition root)。
 *
 * ポート (Context.Tag) に対する本番アダプタ (Layer) をここだけで結び付ける。
 * 「どの実装を使うか」を知っているのはこのファイルのみで、
 * domain / application / presentation は Tag しか知らない (依存性逆転)。
 *
 * shared/ ではなく src 直下に置くのは、features を import する唯一の層だから。
 * 共有基盤 (shared/) が個別 feature を知る構造を避ける。
 */
export const AppLayer = Layer.mergeAll(
  UserRepositoryLive,
  PasswordHasherLive,
  UuidGeneratorLive,
);

/**
 * AppLayer が提供するサービスの総体。
 * union を手で保守せず Layer から導出するため、feature 追加時は
 * AppLayer に足すだけで済む。
 */
export type AppServices = Layer.Layer.Success<typeof AppLayer>;

/**
 * 本番相当の依存を備えたランタイムの型。
 *
 * ManagedRuntime は Layer を一度だけ構築して保持する実行環境で、
 * Effect (R が未解決のレシピ) を実際に走らせる出口になる。
 * 構築は起動時の一度きりなので、接続プールのような資源も使い回せる。
 *
 * 実体の生成は main.ts (本番) / テスト (差し替えた Layer) が行う。
 */
export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, never>;
