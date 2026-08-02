import { Layer, type ManagedRuntime } from "effect";

import { UserLayer } from "~/contexts/user/user-layer";
import { PasswordHasherLive } from "~/shared/service/password-hasher";
import { UuidGeneratorLive } from "~/shared/service/uuid-generator";

/**
 * ここは Layer (提供側) と Runtime の型 (要求側) を **同じファイルに同居させている**。
 * コンテキスト側 (`contexts/<ctx>/user-layer.ts` と `user-runtime.ts`) を
 * 2 ファイルに分けているのとは方針が違うので、理由を残しておく。
 *
 * 1. **分けても結合が減らない。** AppServices は `Layer.Layer.Success<typeof AppLayer>`
 *    で AppLayer から導出している。別ファイルにしても、そちらが AppLayer を
 *    import することになるだけ。手で列挙し直せば分離できるが、
 *    「コンテキスト追加時は AppLayer に足すだけで済む」という利点を失う。
 * 2. **分ける動機 (境界) がない。** コンテキスト側で分けたのは、要求側の型を
 *    presentation が import するため。実装を知るファイルと同居させると
 *    presentation → 実装の経路ができてしまう (no-indirect-path-to-impl が検出する)。
 *    ここの利用者は app.ts / main.ts / テストで、いずれも合成側なので
 *    実装を知って構わない。
 *
 * 逆に言えば、AppServices を手書きに変えるか、contexts でない誰かが
 * AppRuntime を必要とし始めたら、この判断は見直す。
 */

/**
 * アプリケーションの合成ルート (composition root)。
 *
 * ポート (Context.Tag) に対する本番アダプタ (Layer) をここだけで結び付ける。
 * 「どの実装を使うか」を知っているのはこのファイルのみで、
 * domain / application / presentation は Tag しか知らない (依存性逆転)。
 *
 * 個々のアダプタは各コンテキストの `*-layer.ts` が束ねているので、
 * ここはコンテキストごとに 1 行で済む (アダプタが増えてもこのファイルは育たない)。
 * 横断サービス (採番・ハッシュ化) だけは特定のコンテキストに属さないため直接置く。
 *
 * shared/ ではなく src 直下に置くのは、contexts を import する唯一の層だから。
 * 共有基盤 (shared/) が個別コンテキストを知る構造を避ける。
 */
export const AppLayer = Layer.mergeAll(
  UserLayer,
  PasswordHasherLive,
  UuidGeneratorLive,
);

/**
 * AppLayer が提供するサービスの総体。
 * union を手で保守せず Layer から導出するため、コンテキスト追加時は
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
