# 03. 境界の強制 — 規約を「読むもの」から「壊せないもの」へ

[`02-architecture.md`](02-architecture.md) の依存ルールは口約束ではなく、
**2 段階で機械的に検査する**。どちらも `pnpm lint:fix` で走る。

|                                                     | 何を見るか                                         | 役割                                   |
| --------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| **oxlint**（`no-restricted-imports` + `overrides`） | import 文の**文字列**                              | エディタ上で即座に気付く速い防波堤     |
| **dependency-cruiser**（`.dependency-cruiser.mjs`） | tsconfig の `paths` を解決した**実ファイルの依存** | 書き方に依らず取りこぼさない検査の本体 |

oxlint は import 文の文字列しか見ないため、相対パスと `~/` 別名の両方を書く必要があり、
書き漏らすと素通りする。厳密な検査は dependency-cruiser が担い、oxlint は
頻出パターンを速く弾く役に徹する。

---

## 層ごとの可否

両ツールで同じ内容を強制している。

| 参照元 →                               | domain | application | infrastructure | presentation | `shared/db` | `generated` |
| -------------------------------------- | :----: | :---------: | :------------: | :----------: | :---------: | :---------: |
| **domain**                             |   —    |      ✗      |       ✗        |      ✗       |      ✗      |      ✗      |
| **application**                        |   ✓    |      —      |       ✗        |      ✗       |      ✗      |      ✗      |
| **infrastructure**                     |   ✓    |      ✓      |       —        |      ✗       |      ✓      |      ✗      |
| **presentation**                       |   ✓    |      ✓      |       ✗        |      —       |      ✗      |      ✓      |
| **shared**                             |   ✗    |      ✗      |       ✗        |      ✗       |      ✓      |      ✗      |
| **`src/app-runtime.ts`**（合成ルート） |   ✓    |      ✓      |       ✓        |      ✓       |      ✓      |      ✗      |

- `generated`（API 契約の生成コード）に触れるのは **presentation だけ**。
  契約の型が内側へ漏れると、契約を変えるたびにドメインまで書き換えが波及する。
- `shared/db`（Drizzle）に触れるのは **infrastructure だけ**。
- **合成ルート（`src/app-runtime.ts`）だけが実装を知る。** 他はポート（`Context.Tag`）越しに使う。

---

## コンテキスト跨ぎ — dependency-cruiser にしか書けないルール

「`contexts/X` は `contexts/Y`（X≠Y）の内部層を import しない」には**後方参照**が要る。
`no-restricted-imports` の glob にはその機能がないため、oxlint では表現できない。

```js
from: { path: "^src/contexts/([^/]+)/" },
to: {
  path: "^src/contexts/([^/]+)/(infrastructure|presentation)/",
  pathNot: "^src/contexts/$1/",   // ← $1 が from の捕捉。自分自身だけ除外する
},
```

これで**コンテキストが何個増えても宣言は 1 つのまま**（組み合わせ n² を書かずに済む）。
ポート（`domain/`・`application/` の interface）への参照は通り、内部層だけが弾かれる。

---

## 違反メッセージは 3 部構成

規約を知らない人がその場で直せるよう、`comment` に
**【違反】【理由】【対処】** を必ず書く。ヘルパーで構造を強制しているので、
新しいルールを足すときも 3 点を書かないと形にならない。

```js
const message = ({ violation, reason, fix }) =>
  [`【違反】${violation}`, `【理由】${reason}`, `【対処】${fix}`].join("\n");
```

【対処】には抽象論ではなく**このプロジェクトの実物**を書く（`UserRepository`、
`src/app-runtime.ts`、`decodeInput` など）。「禁止です」ではなく「代わりにこう書く」まで言う。

> **注意**: 既定の `err` レポーターは `comment` を**表示しない**。
> `package.json` の `check:deps` で `--output-type err-long` を指定している。

---

## 落とし穴

### oxlint の `overrides` は「後勝ちで丸ごと置き換え」

同名ルールは**マージされない**。層ごとに `override` を 1 つだけ用意し、
その層に必要な `group` をすべて書ききること。

実際、当初 `domain` に 2 つの `override` を当てていたため、後者が前者を上書きし、
**`domain` からの DB / 生成コード参照が素通りしていた**。

### 同一コンテキスト内は `no-cross-context-internals` の対象外

`pathNot: "^src/contexts/$1/"` で自分自身を除外しているため、
`contexts/user/presentation` → `contexts/user/infrastructure` は引っかからない。
これは `presentation-not-to-impl` という別ルールで塞いでいる。

### ルールは「書いたら効く」とは限らない

上の 2 件はどちらも、**実際に違反するファイルを作って確認するまで気付かなかった**。
ルールを追加・変更したら、わざと違反させて検出されることと、
**許可すべきものが通ること**の両方を確かめる。

---

## パーサーに swc を使っている理由

dependency-cruiser 同梱の tsc パーサーは `typescript@>=2 <7` しか対応しておらず、
本プロジェクトの TypeScript 7 では **1 ファイルも解析できない**（`0 modules cruised` と出て、
違反ゼロに見えてしまう）。swc は TS の構文解析を自前で行うためバージョンに縛られない。

実行時に出る `missing-typescript-transpiler` 警告はこの構成に由来する既知のもので、
解析自体は swc が完遂しており実害はない（終了コードも 0）。
消す手段は検討したうえで見送っている（詳細は `.dependency-cruiser.mjs` のコメント）。
