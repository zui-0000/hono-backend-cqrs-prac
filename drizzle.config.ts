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
  out: "./db/migrations",
  dialect: "postgresql",
  migrations: {
    // ファイル名の接頭辞を連番 (0000_) ではなくタイムスタンプにする。
    // 形式は YYYYMMDDHHMMSS で、時刻は UTC (JST の朝は前日の日付になる点に注意)。
    // 連番だとブランチを分けて作業したとき同じ番号が衝突するが、
    // タイムスタンプなら衝突しない。適用順は _journal.json の idx が持つので
    // ファイル名は「いつ作ったか」を読むためのもの。
    prefix: "timestamp",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
