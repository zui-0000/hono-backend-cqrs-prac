import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * auth コンテキストが所有するテーブル定義 (Drizzle スキーマ)。
 *
 * アクセストークン用のテーブルは作らない。あれは JWT で状態を持たず、
 * 検証は署名だけで完結するため保存するものが無い
 * (方式の決定は docs/05-auth/01-our-approach.md)。
 */

/**
 * リフレッシュトークン。1 行 = 券 1 枚。
 *
 * user_id は t_user を指すが、**外部キー制約は張らない**。制約を張ると
 * 「user コンテキストの削除が auth の都合で失敗する」という結合が生まれ、
 * コンテキストを分けた意味が消えるため。参照整合性はアプリ側の手順で保つ
 * (詳細は 01-database.md「コンテキストを跨ぐ参照に FK を張らない」)。
 */
export const tRefreshToken = pgTable(
  "t_refresh_token",
  {
    // 券 1 枚の識別子。ローテーションのたびに新しい行 = 新しい id になる。
    id: uuid("id").primaryKey(),

    // ログインからログアウトまでを貫く識別子。**ローテーションを跨いで変わらない**。
    // アクセストークン (JWT) の sid クレームに載せるのはこちら。
    //
    // 券の id を載せると、古いアクセストークンを持つタブからのログアウトが
    // 「既に失効した行」を消しにいって空振りする (新しい行が生き残る)。
    // セッション単位で持てば、どのタブから叩いても同じセッションが落ちる。
    sessionId: uuid("session_id").notNull(),

    // 券そのものではなくハッシュを保存する。漏洩時にそのまま使われないようにするため。
    // 高エントロピーな乱数なので argon2 は不要で SHA-256 で足りる
    // (総当たりの前提が違う。パスワードのように推測されうる値ではない)。
    tokenHash: text("token_hash").notNull().unique(),

    userId: uuid("user_id").notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    // 失効した時刻。**真偽値ではない**のは、ローテーション直後の猶予期間の判定に
    // 「いつ失効したか」が要るため。行を消さないのは「失効済みの券が使われた」を
    // 検出するためで、消すと盗難の兆候が「知らない券」と区別できなくなる。
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // ログアウトはセッション単位で失効させる。
    index("t_refresh_token_session_id_idx").on(table.sessionId),
    // 盗難を検出したとき、その利用者の券をまとめて切る経路。
    index("t_refresh_token_user_id_idx").on(table.userId),
  ],
);
