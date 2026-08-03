# 00. 技術スタック

| 領域               | 採用                                       |
| ------------------ | ------------------------------------------ |
| ランタイム         | Bun                                        |
| Web フレームワーク | Hono                                       |
| 関数型基盤         | Effect（Effect-TS）                        |
| パッケージ管理     | pnpm                                       |
| ツールチェーン管理 | mise（Bun / pnpm / Node のバージョン固定） |
| DB                 | PostgreSQL 18（Docker）                    |
| ORM                | Drizzle（`bun-sql` ドライバ）              |
| Lint / Format      | oxlint / oxfmt                             |
| API スキーマ       | TypeSpec（OpenAPI 3.1 を生成）             |
| バリデーション     | Effect Schema（orval で OpenAPI から生成） |
| 言語               | TypeScript                                 |

PostgreSQL のバージョン選定と Drizzle / `bun-sql` を選んだ理由は
[`01-database.md`](01-database.md) にある。

---

## 更新確認が「何も無い」と言うとき

`pnpm check:updates` が沈黙しても、**更新が無いとは限らない**。

pnpm は v11 から [`minimumReleaseAge`](https://pnpm.io/settings/dependency-resolution)
の既定値が **1440 分（24 時間）** で、公開から 24 時間経っていないバージョンを
無視する。侵害されたパッケージを掴まないためのサプライチェーン対策で、
悪意ある公開の多くは 1 時間以内にレジストリから消えることを前提にしている。

つまり `pnpm outdated` の沈黙は「更新が無い」ではなく
**「いま入れられるものは無い」**という意味。実際にこれで一度混乱したので、
2 本に分けてある。

| コマンド                     | 見えるもの                                          |
| ---------------------------- | --------------------------------------------------- |
| `pnpm check:updates`         | いま入れられる更新（pnpm が実際に入れるものと一致） |
| `pnpm check:updates:pending` | 検疫中（24 時間以内の公開）を含む、存在する全部     |

`npm outdated` や `npx npm-check-updates` は検疫を知らないため、
`check:updates:pending` と同じものを出す。**それらが出す版に
`package.json` を書き換えても、24 時間経つまで `pnpm install` は入れない**
（急ぐ場合は `minimumReleaseAgeExclude` で個別に除外する）。

`minimumReleaseAge` を 0 にする案は採らない。最新に追従したい動機と、
公開直後の攻撃を最速で踏む危険は裏表なので、既定の 24 時間はそのまま活かす。

なお `--recursive` は付けない。ワークスペースではないため効果が無く、
`-r` は既定でワークスペースルートを除外するので誤解のもとになる。

---

## Effect（Effect-TS）

ドメインからプレゼンテーションまで [Effect](https://effect.website/) を全面採用し、
関数型で実装している。

- **値オブジェクト / モデル** — `Schema.brand` で名目型として表現し、集約は `Schema.Struct` +
  純粋関数（イミュータブル）で構成する。
- **エラー** — `Data.TaggedError` による型付きエラー。`throw` は使わず、失敗はすべて
  `Effect<A, E, R>` の `E` に現れる。
- **依存注入** — `Context.Tag` でポートを定義し、実装は `Layer` として注入する
  （時刻は `Clock`、採番・ハッシュ化は自前のサービス）。副作用はサービス経由に隔離しており、
  テストでは実装を差し替えて決定的に検証できる。
- **境界** — API 契約（OpenAPI）から生成した Effect Schema でリクエスト / レスポンスを検証する。
  ドメインと同じスキーマ体系のため、検証結果がそのまま Effect のエラーチャネルに乗る。

### 型に出ることの効き方

`Effect<A, E, R>` の 3 つの型引数がそのまま設計の制約になっている。

- **`E`（失敗）** — 何で失敗しうるかが呼び出し側に見える。だから
  「一意性の検証は `check<対象>Duplication`」のように、**名前で失敗を説明しなくてよい**
  （詳細は [`02-architecture.md`](02-architecture.md#命名-check対象duplication)）。
- **`R`（依存）** — I/O を伴うことが型に出る。ドメインサービスがリポジトリのポートを
  読んでも、それが `R` に現れるので「純粋であれ」の戒律を名前や置き場所で守る必要がない。
- **`A`（成功）** — 封筒を外して素の値を返せるのは、応答の形を型が保証しているから。

副産物として、`respondedAt` を廃したときに `errorBody` から時刻取得が消え、
連鎖して `handleErrorResponse` が `Effect` を返す必要すらなくなった
（[`02-architecture.md`](02-architecture.md#api-応答を封筒envelopeで包まない)）。
