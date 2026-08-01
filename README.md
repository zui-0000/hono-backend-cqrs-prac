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
| `pnpm check:types`               | 型チェック（`tsc --noEmit`）                              |
| `pnpm check:lint`                | oxlint（層の境界ルールを含む）                            |
| `pnpm check:deps`                | 依存構造の検査（dependency-cruiser）                      |
| `pnpm check:updates`             | 依存の更新確認                                            |
| `pnpm format:check`              | 整形チェック（oxfmt）                                     |
| `pnpm format:fix`                | 整形適用                                                  |
| `pnpm lint:fix`                  | lint 自動修正 → 整形 → 型チェック → 依存検査（一括）      |
| `pnpm generate:api`              | OpenAPI から Effect Schema を生成（orval, src/generated） |
| `pnpm db:generate --name <name>` | マイグレーション生成（TS スキーマ → SQL）                 |
| `pnpm db:migrate`                | マイグレーション適用                                      |
| `pnpm db:studio`                 | Drizzle Studio（GUI）                                     |

> DB コンテナの起動 / 停止は `docker compose up -d` / `docker compose stop` を直接実行する（pnpm スクリプトにはしていない）。

### スキーマ（TypeSpec / `schema/` 別プロジェクト）

`schema/` は API 契約を TypeSpec で定義する独立プロジェクト。

| script                  | 内容                                                 |
| ----------------------- | ---------------------------------------------------- |
| `pnpm -C schema build`  | `.tsp` → OpenAPI（`schema/dist/openapi.yaml`）を生成 |
| `pnpm -C schema format` | `.tsp` を整形                                        |

スキーマ変更後は **`pnpm -C schema build` → `pnpm generate:api`** の順で Effect Schema まで反映する。

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

- `features/` ではなく `contexts/` としているのは、**コンテキストどうしが関係を持つのを
  前提にするため**。フロントエンド由来の「独立した feature」という含意を避け、DDD の
  文脈マッピング（例: `auth → user` は Customer/Supplier）で関係を説明できる語彙に揃えた。
- **テーブル定義は所有するコンテキストの `infrastructure/drizzle-schema.ts` に置く**。集約（`User`）と
  その保存先（`t_user`）の所有者を揃えることで、他コンテキストが直接その表を書き換える経路が
  「他コンテキストの `infrastructure/` を import する」という目に見える形になり、lint で縛れる。
  物理 DB とマイグレーションは 1 つ（`shared/db/`）のまま — drizzle-kit の `schema` は
  glob を取れるので、分割しても migration は全テーブルまとめて 1 系列で管理できる。
- **バレル（再エクスポート専用の `index.ts`）は置かない**（`src` 配下に 0 個）。
  同じ型に import 経路が 2 本できるのを防ぎ、何がどこから来ているかを import 文だけで
  読めるようにするため。ディレクトリは「公開 API」ではなく単なる置き場所として扱う。
- バレルが無いぶん、**エクスポート名は単体で文脈が分かる形にする**。ドメインの型・関数は
  所属集約で修飾する（`User` / `UserId` / `UserName` / `createUser` / `changeUserProfile`）。
  修飾しないとコンテキストが増えたとき `Id` や `Model` が衝突する。
  ファイル名はエクスポート名に対応させる（`vo/user-id.ts` → `UserId`）。
- **集約をまたぐ業務ルールは `domain/service/` のドメインサービスに置く**。集約 1 つを
  見ても判断できない不変条件（例: メールアドレスの重複）は、エンティティにも値オブジェクトにも
  属さないため。ルールに名前を与えて 1 箇所に集め、「呼ぶ順序」だけを command に残す。
  依存するのは `domain/` のポートだけなので、層の向きは内向きのまま保たれる。
  逆に「対象が居なければ 404」のようなユースケースごとの方針は command に残す（業務ルールではない）。
- **一意性の検証は `check<対象>Duplication` に統一する**（例: `checkMailAddressDuplication`）。
  失敗するかどうか・何で失敗するかは Effect の型（`E` チャネル）が語るので、名前は
  「何を見るか」だけを言う。`validate*` は presentation 層の契約スキーマ検証で使うため避ける。
- ただし **brand / DI / エラーのタグ文字列はエクスポート名と一致させなくてよい**。
  グローバル一意でありさえすればよい識別子なので、`UserId` の brand は
  `Schema.brand("User.Id")` のままドット区切りで階層を表す。
- `infrastructure/` の中身は、**何であるかによって修飾の仕方を変える**。
  - **ポートの実装は「ポート名 + `Live`」**（`user-repository-live.ts` → `UserRepositoryLive`）。
    ポートとファイル名が完全に同じになるのを避けつつ（`domain/user-repository.ts` と
    区別できる）、ファイル名＝エクスポート名の規約も保てる。`Live` は本番用 Layer を指す
    Effect の慣習で、`PasswordHasherLive` などと語が揃う。
  - **ポートを持たない技術固有の資産は「技術名」で修飾する**（`drizzle-schema.ts`）。
    抽象の裏に隠れていない Drizzle むき出しの資産であること、および `schema` という語が
    このリポジトリで多義（TypeSpec の API 契約 / Effect Schema / 生成物 / PostgreSQL の
    ネームスペース）であることの両方に対処する。

### 境界の強制（規約を「読むもの」から「壊せないもの」へ）

上記の依存ルールは口約束ではなく、2 段階で機械的に検査する。

|                                                     | 何を見るか                                         | 役割                                   |
| --------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| **oxlint**（`no-restricted-imports` + `overrides`） | import 文の**文字列**                              | エディタ上で即座に気付く速い防波堤     |
| **dependency-cruiser**（`.dependency-cruiser.mjs`） | tsconfig の `paths` を解決した**実ファイルの依存** | 書き方に依らず取りこぼさない検査の本体 |

両方 `pnpm lint:fix` で走る。とくに **コンテキスト跨ぎのルールは dependency-cruiser にしか書けない**。
「`contexts/X` は `contexts/Y`（X≠Y）の内部層を import しない」には後方参照が要るため:

```js
from: { path: "^src/contexts/([^/]+)/" },
to: {
  path: "^src/contexts/([^/]+)/(infrastructure|presentation)/",
  pathNot: "^src/contexts/$1/",   // ← $1 が from の捕捉。自分自身だけ除外する
},
```

これでコンテキストが何個増えても宣言は 1 つのまま（組み合わせ n² を書かずに済む）。
**ポート（`domain/`・`application/` の interface）への参照は通り、内部層だけが弾かれる**。

なお dependency-cruiser のパーサーには **swc** を使っている。同梱の tsc パーサーは
`typescript@>=2 <7` しか対応しておらず、本プロジェクトの TypeScript 7 では 1 ファイルも
解析できない（`0 modules cruised`）ため。実行時に出る `missing-typescript-transpiler`
警告はこの構成に由来する既知のもので、解析自体は swc が行っており実害はない（終了コードも 0）。

- 依存の向きは常に内向き。「どの実装を使うか」を知るのは `src/runtime.ts` だけで、
  `shared/` は contexts を import しない。controller は `createApp(runtime)` 経由で
  ランタイムを受け取るため、テストでは Layer を差し替えて DB なしで HTTP 境界ごと検証できる。
- コンテキストを跨ぐ参照は**ポート（`domain/`・`application/` の interface）に限る**。
  他コンテキストの `infrastructure/` を直接 import しない。書き込み（集約の変更）は
  必ず所有コンテキストの command を通す。

## ドキュメント

- [`docs/01-database.md`](docs/01-database.md) — DB 周りの設計と運用（なぜその選択をしたか）
