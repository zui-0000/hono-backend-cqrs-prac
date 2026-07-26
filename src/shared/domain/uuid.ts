import { Schema } from "effect";

// UUID v7 の形式 (TypeSpec schema 側の Uuid と同一パターン)。
const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * UUID v7 形式の文字列スキーマ (未 brand・共有ドメイン)。
 *
 * 各集約の id 値オブジェクトは、これに固有の brand を重ねて定義する:
 *   export const Id = Uuid.pipe(Schema.brand("User.Id"));   // features/user 側
 *
 * これにより「uuidv7 という形式検証」は共有しつつ、
 * 集約ごとの id 型は名目的に区別 (User.Id と Order.Id を混用不可) に保つ。
 */
export const Uuid = Schema.String.pipe(Schema.pattern(UUID_V7_PATTERN));
