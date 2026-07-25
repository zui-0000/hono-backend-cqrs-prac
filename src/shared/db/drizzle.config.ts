import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit (migration 生成/適用) の設定。DB 関連を shared/db に集約するため
// 設定ファイルもここに置く。schema / out のパスはコマンド実行時の CWD
// (リポジトリルート) 基準で解決される点に注意。
export default defineConfig({
  // テーブル定義はバックエンド全体で 1 ファイルに集約する (物理DBは共有インフラのため)。
  schema: "./src/shared/db/schema.ts",
  out: "./src/shared/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
