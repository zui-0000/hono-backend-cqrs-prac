import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit (migration 生成/適用) の設定。DB 関連を shared/db に集約するため
// 設定ファイルもここに置く。schema / out のパスはコマンド実行時の CWD
// (リポジトリルート) 基準で解決される点に注意。
export default defineConfig({
  // テーブル定義は所有するコンテキストの infrastructure に置く (集約と所有者を揃える)。
  // drizzle-kit は schema に glob / 配列を取れるため、分割しても migration は
  // 全テーブルをまとめて 1 系列 (out) で管理できる。
  schema: "./src/contexts/*/infrastructure/drizzle-schema.ts",
  out: "./src/shared/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
