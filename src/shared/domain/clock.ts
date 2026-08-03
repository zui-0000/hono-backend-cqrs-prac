import { Clock, Effect } from "effect";

/**
 * 現在時刻を JS Date として取得する。
 * 時刻という副作用は Effect 標準の Clock サービス経由で読む
 * (new Date() 直書きを避け、テストでは TestClock で固定可能に)。
 *
 * これは新しいサービス (Tag) ではなく、既存の Clock を Date に整える薄いアダプタ。
 * 時刻取得の抽象化＝Clock が既に担っているため、二重に DI しない。
 *
 * infrastructure/ ではなくここに置く理由: このファイルは何も実装していない。
 * 実際に時計を読むのは Effect のランタイムで、ここは millis を Date に
 * 整えているだけ。Bun の API を直接呼ぶ *-live.ts とは立場が違う。
 * 実際、domain/model/user.ts が createdAt / updatedAt を打つのに now を使うため、
 * infrastructure/ へ移すと domain-not-to-outer に引っかかる。
 * ドメインが依存してよいのは、Clock が実装ではなく抽象だから
 * (別案として「時刻は引数で受け取り、ドメインは時計を知らない」形もあるが、
 * 集約ごとに呼び出し側が timestamp を用意する手間を嫌って採らなかった)。
 *
 * domain/ 直下に置く理由: 語彙を model/ に集めたうえで、
 * 直下には「ドメインが環境から得るもの」だけを残す形にしているため。
 * contexts/<ctx>/domain/ が model/ と services/ を切って
 * user-repository.ts を直下に置いているのと同じ並びになる。
 *
 * このファイルだけは Tag を宣言していない (上記のとおり Clock は Effect が持つ) が、
 * 「環境から得るもの」という位置づけは採番・ハッシュ化と変わらないので隣に置く。
 * 宣言の有無は「どうやって」の話で、分類の軸にはしない。
 *
 * 以前は shared/services/ に置いていたが、あれは層でもトピックでもない名前のうえ、
 * ドメインが要求するものを domain の外に置く形になっていた。
 */
export const now: Effect.Effect<Date> = Effect.map(
  Clock.currentTimeMillis,
  (millis) => new Date(millis),
);
