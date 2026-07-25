import { drizzle } from "drizzle-orm/bun-sql";

// アプリ共有の Drizzle クライアント。Bun ネイティブ SQL 経由で PostgreSQL に接続する
// (別ドライバ非依存)。接続情報は環境変数から。Bun は .env を自動読込する。
export const db = drizzle(process.env.DATABASE_URL!);
