import { Clock, Effect } from "effect";

/**
 * 現在時刻を JS Date として取得する。
 * 時刻という副作用は Effect 標準の Clock サービス経由で読む
 * (new Date() 直書きを避け、テストでは TestClock で固定可能に)。
 *
 * これは新しいサービス (Tag) ではなく、既存の Clock を Date に整える薄いアダプタ。
 * 時刻取得の抽象化＝Clock が既に担っているため、二重に DI しない。
 */
export const now: Effect.Effect<Date> = Effect.map(
  Clock.currentTimeMillis,
  (millis) => new Date(millis),
);
