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
