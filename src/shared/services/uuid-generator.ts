import { Context, Effect, Schema } from "effect";

/**
 * UUID (v7) を生成するサービス。
 * 採番という副作用を Effect に閉じ込め、DI で差し替え可能にする
 * (テストでは固定 UUID を返す実装を渡せる → 決定的なテスト)。
 *
 * ※ 本システムは id 戦略として uuidv7 を採用 (shared/domain の Uuid と対)。
 *    「汎用 id 源」ではなく "uuid を作る" 契約をそのまま名前に表している。
 *
 * 型 (interface) と Tag (const) を同名で定義し、DI の鍵と依存型を1つの名前で扱う。
 */
export interface UuidGenerator {
  readonly next: Effect.Effect<string>;
}
export const UuidGenerator = Context.GenericTag<UuidGenerator>("UuidGenerator");

/**
 * 与えた branded uuid スキーマの新規 id を採番する (アプリ側採番)。
 * UuidGenerator から生の uuid を得て、対象スキーマへ decode してブランドを付ける。
 * 生成値は必ず妥当なので、decode 失敗は defect (orDie) 扱い。
 *
 * branded な id 型は集約ごとに別物 (UserId ≠ OrderId) だが、
 * 「生 uuid → 各 brand へ decode」という定型はこの1関数で共有する。
 * 各集約は `export const generateUserId = generateBrandedUuid(UserId);` と
 * 1行で採番関数を得る。
 */
export const generateBrandedUuid = <A extends string>(
  schema: Schema.Schema<A, string>,
): Effect.Effect<A, never, UuidGenerator> =>
  Effect.gen(function* () {
    const uuidGenerator = yield* UuidGenerator;
    const raw = yield* uuidGenerator.next;
    return yield* Schema.decode(schema)(raw).pipe(Effect.orDie);
  });
