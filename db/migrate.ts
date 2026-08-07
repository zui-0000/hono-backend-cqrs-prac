import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

// マイグレーション適用スクリプト。
// drizzle-kit の migrate は Bun ネイティブ SQL ドライバに非対応 (pg/postgres.js 等を要求) のため、
// アプリと同じ drizzle-orm/bun-sql のランタイムマイグレータで適用する。
// 本番 (ECS タスク等) でも同じ方式で「bun run」して流せる。
const db = drizzle(process.env.DATABASE_URL!);

await migrate(db, { migrationsFolder: "./db/migrations" });

console.log("✅ migrations applied");
process.exit(0);
