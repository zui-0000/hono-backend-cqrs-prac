import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// 識別子はアプリ側 (ドメインの生成ファクトリ) で Bun.randomUUIDv7() を採番する。
// 集約が生成時点で identity を持つ DDD 王道の戦略のため、DB 側の DEFAULT は付けない。
export const tUser = pgTable("t_user", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  // ログインの識別子になるため一意制約を付ける。文字数上限は RFC 5321 の実質上限 254 に収まる 255。
  mailAddress: varchar("mail_address", { length: 255 }).notNull().unique(),
  // パスワードのハッシュ (argon2id)。平文は保存しない。ハッシュ化はアプリ層 (Bun.password) が行う。
  hashedPassword: text("hashed_password").notNull(),
  // 作成/更新時刻はドメイン (User 集約) が Clock 経由で決める。
  // DB 側で上書きするとドメインが決めた値が失われるため、$onUpdate は付けない。
  // DEFAULT は直接 INSERT する場合の保険として残す。
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
