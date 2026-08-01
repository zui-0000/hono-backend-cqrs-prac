# hono-backend-cqrs-prac

Hono + CQRS + DDD を学習するためのバックエンド（Bun ランタイム）。

## 技術スタック

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

### Effect（Effect-TS）について

ドメインからプレゼンテーションまで [Effect](https://effect.website/) を全面採用し、関数型で実装している。

- **値オブジェクト / モデル** — `Schema.brand` で名目型として表現し、集約は `Schema.Struct` +
  純粋関数（イミュータブル）で構成する。
- **エラー** — `Data.TaggedError` による型付きエラー。`throw` は使わず、失敗はすべて
  `Effect<A, E, R>` の `E` に現れる。
- **依存注入** — `Context.Tag` でポートを定義し、実装は `Layer` として注入する
  （時刻は `Clock`、採番・ハッシュ化は自前のサービス）。副作用はサービス経由に隔離しており、
  テストでは実装を差し替えて決定的に検証できる。
- **境界** — API 契約（OpenAPI）から生成した Effect Schema でリクエスト / レスポンスを検証する。
  ドメインと同じスキーマ体系のため、検証結果がそのまま Effect のエラーチャネルに乗る。

## 前提

- [mise](https://mise.jdx.dev/)（ランタイム/ツールのバージョン管理）
- Docker（開発用 PostgreSQL）

## セットアップ

```zsh
# 1. Bun / pnpm / Node を mise.toml のバージョンで導入
mise install

# 2. 依存をインストール
pnpm install

# 3. 環境変数を用意（ローカル DB 接続情報）
cp .env.example .env

# 4. 開発用 PostgreSQL を起動（停止は docker compose stop）
docker compose up -d

# 5. マイグレーションを生成（スキーマ変更時。初回 clone は既存 migration があるので省略可）
pnpm db:generate --name <name>

# 6. マイグレーションを適用（t_user 等を作成）
pnpm db:migrate
```

## 起動

```zsh
pnpm dev
```

実装済みのエンドポイント（`/health` を除き `X-Request-Id` ヘッダに UUID v7 が必須）:

| メソッド | パス          | 内容                     | 成功時 |
| -------- | ------------- | ------------------------ | ------ |
| `GET`    | `/health`     | ヘルスチェック           | 200    |
| `POST`   | `/users`      | ユーザー作成             | 201    |
| `GET`    | `/users/{id}` | ユーザー取得（クエリ側） | 200    |
| `PUT`    | `/users/{id}` | ユーザー更新             | 204    |
| `DELETE` | `/users/{id}` | ユーザー削除             | 204    |

契約上 `GET` / `PUT` / `DELETE` は要認証（Bearer）だが、認証は auth コンテキストの実装後に追加する。

**応答は封筒（envelope）で包まない。** リソースの内容をそのまま返す
（[理由](docs/02-architecture.md#api-応答を封筒envelopeで包まない)）。

```jsonc
// 200 GET /users/{id}
{ "name": "アスカ", "mailAddress": "asuka@example.com" }
// 201 POST /users … 採番された id だけを返す（クライアントが GET を呼べるように）
{ "id": "019fbf41-5fcd-7000-b147-14f2ed63cf2f" }
// エラー
{ "errorCode": "4040", "message": "指定されたユーザーは存在しません" }
```

```zsh
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: $(bun -e 'console.log(Bun.randomUUIDv7())')" \
  -d '{"name":"アスカ","mailAddress":"asuka@example.com","password":"SuperSecret123!"}'
```

## スクリプト

| script                           | 内容                                                      |
| -------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                       | 開発サーバ（ホットリロード）                              |
| `pnpm start`                     | 通常起動                                                  |
| `pnpm test`                      | テスト（`bun test`）                                      |
| `pnpm lint:fix`                  | lint 自動修正 → 整形 → 型チェック → 依存検査（一括）      |
| `pnpm check:updates`             | 依存の更新確認（`schema/` は含まない。下記参照）          |
| `pnpm generate:api`              | OpenAPI から Effect Schema を生成（orval, src/generated） |
| `pnpm db:generate --name <name>` | マイグレーション生成（TS スキーマ → SQL）                 |
| `pnpm db:migrate`                | マイグレーション適用                                      |
| `pnpm db:studio`                 | Drizzle Studio（GUI）                                     |

個別の `check:*` / `format:*` も `package.json` にあるが、`lint:fix` が内部で順に呼ぶため
普段は使わない（CI で段階ごとに分けたくなったときのために残してある）。

> DB コンテナの起動 / 停止は `docker compose up -d` / `docker compose stop` を直接実行する（pnpm スクリプトにはしていない）。

### スキーマ（TypeSpec / `schema/` 別プロジェクト）

`schema/` は API 契約を TypeSpec で定義する独立プロジェクト。
ディレクトリの切り方は `src/` と揃えてある（`schema/src/contexts/<context>/` と
`schema/src/shared/`）。契約とコードで同じ語彙・同じ区切りを使うことで、
「この endpoint はどのコンテキストの持ち物か」が両側で一致する。

| script                         | 内容                                                 |
| ------------------------------ | ---------------------------------------------------- |
| `pnpm -C schema build`         | `.tsp` → OpenAPI（`schema/dist/openapi.yaml`）を生成 |
| `pnpm -C schema format`        | `.tsp` を整形                                        |
| `pnpm -C schema check:updates` | 依存の更新確認（`@typespec/*`）                      |

スキーマ変更後は **`pnpm -C schema build` → `pnpm generate:api`** の順で Effect Schema まで反映する。

`schema/` はワークスペースメンバーではなく**独立したプロジェクト**なので、
root の `pnpm` コマンドは `--recursive` を付けても届かない。依存の更新確認は
両方で打つ必要がある。

`pnpm -C schema preview` で生成した OpenAPI を Redoc（`http://localhost:8080`, 要 Docker）に表示できる。

## ディレクトリ構成

```text
schema/                 # TypeSpec による API 契約（独立プロジェクト, OpenAPI 3.1 出力）
src/
├─ main.ts              # エントリ（Bun）。本番の Layer から runtime を作り app に注入
├─ app.ts               # Hono アプリの組み立て（ルーティング + runtime の注入点）
├─ runtime.ts           # 合成ルート。Layer の結線（contexts を知る唯一の層）
├─ contexts/            # 境界づけられたコンテキスト単位で縦に切る
│  └─ <context>/        #   例: user / auth
│     ├─ domain/        #     model/（集約・値オブジェクト）, service/（ドメインサービス）, ポート
│     ├─ application/   #     command / query（CQRS）
│     ├─ infrastructure/#     テーブル定義 / リポジトリ実装（domain ↔ DB 変換, Layer）
│     └─ presentation/  #     controller（HTTP ↔ Effect の境界）
├─ shared/
│  ├─ domain/           # コンテキストを跨ぐ値オブジェクト（Uuid / MailAddress / Password）
│  ├─ error/            # API エラーカタログ（errorCode 体系と型付きエラー）
│  ├─ presentation/     # ハンドラ / 検証 / エラー翻訳 / リクエストログ の共通基盤
│  ├─ service/          # 横断サービス（採番・ハッシュ化）のポートと実装
│  └─ db/               # Drizzle クライアント / マイグレーション基盤（テーブル定義は持たない）
├─ __tests__/           # テストは対象と同階層の __tests__ に置く（コロケーション）
└─ generated/           # orval が OpenAPI から生成（gitignore, prepare で再生成）
docs/                   # 設計と学びの記録
```

この構成にした理由・命名の規約は [`docs/02-architecture.md`](docs/02-architecture.md) に、
それをどう機械的に強制しているかは [`docs/03-boundary-enforcement.md`](docs/03-boundary-enforcement.md) に分けてある。
要点だけ挙げると:

- **依存の向きは常に内向き。** 「どの実装を使うか」を知るのは `src/runtime.ts`（合成ルート）だけ。
  controller は `createApp(runtime)` 経由でランタイムを受け取るため、テストでは Layer を
  差し替えて DB なしで HTTP 境界ごと検証できる。
- **コンテキストを跨ぐ参照はポート（`domain/`・`application/` の interface）に限る。**
  他コンテキストの `infrastructure/` は直接 import しない。書き込みは必ず所有コンテキストの
  command を通す。
- **バレル（再エクスポート専用の `index.ts`）は置かない**（`src` 配下に 0 個）。
  代わりにエクスポート名を単体で読める形にする（`UserId` / `createUser` / `UserRepositoryLive`）。
- **上記はすべて lint で強制している。** 破ると `pnpm lint:fix` が落ちる
  （oxlint + dependency-cruiser）。

## コミット

Conventional Commits（`feat` / `fix` / `refactor` / `chore` + スコープ）。

- **破壊的変更マーカー `!` は、`schema/`（API 契約）が変わってクライアントが壊れる場合にだけ付ける**
  （例: `feat(api)!: envelope パターンを廃止し、応答をフラットにする`）。
  判定基準を「外部契約が壊れるか」に固定しておくと迷いようがない。
  内部のリネームや構造変更（バレル廃止、`features/` → `contexts/` など）は、
  どれだけ広範囲でも `!` を付けない — 直すのは自分たちだけだから。
- semantic-release 等は入れていないため `!` を読むのは人間だけ。機械的な効果はない。

## ドキュメント

いずれも「**なぜその選択をしたか**」を残すことを目的にしている。

- [`docs/01-database.md`](docs/01-database.md) — DB 周りの設計と運用
  （Postgres / Drizzle の選定、id 戦略、マイグレーション運用）
- [`docs/02-architecture.md`](docs/02-architecture.md) — 構造と命名の規約
  （`contexts/` の理由、バレル不使用、`infrastructure/` の命名、ドメインサービス、応答の形）
- [`docs/03-boundary-enforcement.md`](docs/03-boundary-enforcement.md) — 境界の機械的な強制
  （oxlint と dependency-cruiser の役割分担、層ごとの可否表、踏んだ落とし穴）
