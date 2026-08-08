import { defineConfig } from "orval";

// OpenAPI (TypeSpec が生成) から Effect Schema を生成する設定。
// - client: "effect" … fetch クライアント等は作らず Effect Schema のみ生成 (バックエンド検証用)
// - mode: "tags"     … タグ (Users / Auth) ごとにファイル分割
// 生成物は src/generated 配下。ドメイン層と同じ Effect Schema なので、
// 境界での decode 結果がそのまま Effect のエラーチャネルに乗る。
export default defineConfig({
  backend: {
    input: {
      target: "./schema/dist/openapi.yaml",
    },
    output: {
      client: "effect",
      mode: "tags",
      target: "./src/generated",
      override: {
        effect: {
          // 名前付きスキーマ (UserId 等) を branded 型として生成する。
          // ※ これは「API 契約上の型」であり、ドメイン層の VO (User.Id 等) とは別物。
          useBrandedTypes: true,
          // レスポンスをステータスコードごとに生成する (400/409/500 のエラー型も得るため)。
          generateEachHttpStatus: true,
        },
      },
    },
    // 生成物は整形しない。
    //
    // 以前は afterAllFilesWrite で oxfmt を掛けていたが、oxfmt 0.62 から
    // **.gitignore が無条件で尊重される**ようになり、--ignore-path で無効化できなくなった
    // (src/generated は gitignore 済み)。空の ignore ファイルを渡しても結果は同じで、
    // .gitignore を外したときだけ整形できることを確認している。
    //
    // フックは「Expected at least one target file」で毎回 exit 2 になっていた。
    // orval 本体は成功して 🎉 を出すため、失敗しているように見えないのが厄介だった。
    //
    // --no-error-on-unmatched-pattern でエラーだけ消す手もあるが、それは整形もされないまま
    // 成功したように見せるだけなので採らない。生成物は gitignore 済みでレビュー対象外でもあり、
    // 整形されないことを受け入れる。
  },
});
