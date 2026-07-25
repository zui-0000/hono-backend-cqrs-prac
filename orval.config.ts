import { defineConfig } from "orval";

// OpenAPI (TypeSpec が生成) から zod スキーマを生成する設定。
// - client: "zod" … fetch クライアント等は作らず zod スキーマのみ生成 (バックエンド検証用)
// - mode: "tags"  … タグ (Users / Auth) ごとにファイル分割
// - zod.version 4 … zod v4 構文で出力
// 生成物は src/generated 配下 (型は z.infer で導出)。
export default defineConfig({
  backend: {
    input: {
      target: "./schema/dist/openapi.yaml",
    },
    output: {
      client: "zod",
      mode: "tags",
      target: "./src/generated",
      override: {
        zod: {
          version: 4,
        },
      },
    },
    hooks: {
      // 生成後に生成物だけ oxfmt で整形する。
      // src/generated は .gitignore 済みのため、--ignore-path=/dev/null で gitignore を無効化して対象に含める。
      afterAllFilesWrite: "oxfmt -c .oxfmtrc.jsonc --ignore-path=/dev/null",
    },
  },
});
