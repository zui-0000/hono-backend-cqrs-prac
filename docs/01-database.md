# 01. データベース周りの設計と運用

このプロジェクトの永続化層（Docker / PostgreSQL / Drizzle / マイグレーション）に関する
決定事項と、その **なぜ** を残す。

---

## 全体像：ローカルと本番の分離

| 層     | ローカル                                       | 本番（想定）                       |
| ------ | ---------------------------------------------- | ---------------------------------- |
| DB     | Docker の Postgres 18（`docker-compose.yaml`） | **AWS RDS**（マネージド Postgres） |
| アプリ | mise + Bun でホスト実行                        | **ECS Fargate**（ECR のイメージ）  |

- **`docker-compose.yaml` はローカル専用**。本番の DB はコンテナで動かさず RDS を使う。
  つまり compose の Postgres は「本番の縮小版」ではなく、開発用の使い捨て。
- 本番のアプリは ECR イメージを Fargate で実行する（Dockerfile は別途構築予定）。

---

## PostgreSQL のバージョン選定

- **18 を採用**（2025-09 リリースの安定版。最新パッチ系）。
  - 決め手: `uuidv7()` が **コア関数**として追加され、拡張なしで使える。
- **19 は Beta のため不採用**（本番/開発 DB には非推奨）。
- **alpine を避けた**理由:
  - alpine は musl libc で **locale / 照合順序（collation）対応が限定的**。
  - 本番 RDS は glibc なので、**パリティのため local も glibc（既定の debian 版）に揃える**。
  - DB は stateful でイメージ容量削減の旨味も薄い（一度 pull して使い続ける）。
  - 対比: **stateless なアプリイメージは alpine/slim でOK**（軽量が正義）。使い分ける。

---

## ORM: Drizzle

- **選定理由**: 軽量・SQL に近い・Bun 一級対応。手動マッピングで domain を汚さず、
  永続化モデル↔集約の変換を自分で書けるので DDD と相性が良い。
- **ドライバ**: `drizzle-orm/bun-sql`（Bun ネイティブ SQL）。`pg` / `postgres.js` 等の
  別ドライバ依存が不要。
- TS/npm 対比: Prisma がフルスタック ORM、Drizzle は「型付き knex」的な薄いレイヤ。

---

## ディレクトリ構成（`src/shared/db/`）

```text
src/shared/db/
├─ client.ts          # 接続クライアント（bun-sql）
├─ schema.ts          # 全テーブル定義を一元管理
├─ drizzle.config.ts  # drizzle-kit 設定
├─ scripts/
│  └─ migrate.ts      # ランタイムマイグレータ（bun-sql）
└─ migrations/        # 生成 SQL + meta（git 管理）
```

- **スキーマを 1 ファイルに集約した理由**: 物理 DB は共有インフラで、FK が境界を跨ぐ。
  一望できて関係整合も扱いやすい。
- **ドメインモデル（集約・値オブジェクト）は `contexts/<context>/domain/` にコンテキストごとで残す**。
  DDD の芯（境界ごとのドメイン分離）はそちらで守る。テーブル↔ドメインの変換は
  `contexts/<context>/infrastructure/` の repository が担い、`~/shared/db/schema` を import する
  （contexts → shared の正しい依存方向）。

---

## t_user テーブル

| カラム          | 型           | 制約 / 既定                                           |
| --------------- | ------------ | ----------------------------------------------------- |
| id              | uuid         | PRIMARY KEY（**DB DEFAULT なし** = アプリ側採番）     |
| name            | varchar(100) | NOT NULL                                              |
| mail_address    | varchar(255) | NOT NULL, UNIQUE                                      |
| hashed_password | text         | NOT NULL（パスワードのハッシュ。argon2id 想定）       |
| created_at      | timestamptz  | NOT NULL, DEFAULT now()                               |
| updated_at      | timestamptz  | NOT NULL, DEFAULT now()（更新はアプリ側 `$onUpdate`） |

---

## 識別子戦略：アプリ側採番

- **採用**: ドメインの生成ファクトリで **`Bun.randomUUIDv7()`**（Bun ネイティブ、依存ゼロ）。
- **理由（DDD）**: 集約は生成された瞬間から identity を持つべき。DB 採番だと id が
  永続化に依存し、「保存前に id を使えない / ドメインの単体テストに DB が要る /
  集約が未完成のまま生まれる」といった問題が連鎖する。
- Vaughn Vernon『実践 DDD』の序列でも **アプリ早期採番 > 永続化採番**。
- uuidv7 はアプリ生成でも **時間順序**なので、インデックス局所性の利点はそのまま得られる
  （DB 側 `uuidv7()` の売りが相殺される）。
- スキーマ上は `id` に DB DEFAULT を付けない（アプリが必ず id を渡す）。

---

## 文字数制限

- **mail_address = 255**: RFC 5321 の実質上限 254 に収まる切りのいい値。
  （内訳: ローカル部 64 + ドメイン部 255、SMTP 経路制約で全体 254）
- **name = 100**: 技術的上限はなく業務ルール。日英どちらの名前にも十分でバランスが良い。
- **hashed_password = text（上限なし）**: name / mail とは逆に、これは**サーバー生成の不透明値**
  （`Bun.password` が出力するハッシュ）で、ユーザーが長さを操作できないため暴走入力を防ぐ上限が不要。
  むしろ `varchar(n)` で縛ると、アルゴリズム/パラメータ変更でハッシュ長が伸びた時に
  **サイレント切り捨て → 認証が壊れる**危険がある（text と varchar(n) は Postgres 上で性能差なし）。
- 補足: 本来 name / mail の上限は **API 層（TypeSpec / zod）でも二重に守る**予定。DB は最後の砦。

> **原則**: ユーザー入力の列は上限で守る（`varchar`）。サーバー生成の不透明値は `text` で切り捨て事故を防ぐ。

---

## マイグレーション運用

### generate と migrate は分ける

```text
schema.ts 編集
  → pnpm db:generate --name <name>   # TS → SQL 生成（DB 不要・差分計算）
  → 生成 SQL をレビュー
  → pnpm db:migrate                  # SQL を DB に適用（冪等）
```

- **generate**: TS スキーマと「前回スナップショット（`meta/`）」の差分を SQL に書き出す。DB 接続不要。
- **migrate**: 生成済み SQL を DB に適用。`__drizzle_migrations` テーブルで適用済みを記録し、
  未適用分だけ流す（冪等）。
- **分ける理由**:
  1. 生成 SQL を**レビュー**できる（破壊的変更・データ消失を事前に検知）。
  2. **本番では migrate しか実行しない**（generate は開発時に 1 回だけ、成果物を commit）。

### コマンド

| script                           | 内容                                                                 |
| -------------------------------- | -------------------------------------------------------------------- |
| `pnpm db:generate --name <name>` | マイグレーション生成（**必ず `--name` を付ける**。無いとランダム名） |
| `pnpm db:migrate`                | 適用（`bun run src/shared/db/scripts/migrate.ts`）                   |
| `pnpm db:studio`                 | GUI（`https://local.drizzle.studio`）                                |

DB コンテナの起動 / 停止は `docker compose up -d` / `docker compose stop` を直接実行する（pnpm スクリプトにはしていない）。

### migrations は git 管理する

- **`schema.ts` = 目的地、`migrations/` = そこへ至る道順**。既存データを壊さず変化させるには
  道順（順序付き SQL）が要る。schema だけでは足りない。
- `meta/`（スナップショット・目録）も **セットでコミット**（次回 generate の差分基準になるため）。
- append-only で増えていくのが正常。ただし **どの DB にも適用していない間（pre-prod）は
  リセット（`rm -rf migrations` して再生成）してよい**。一度でも適用したら追記のみ。

### ランタイムマイグレータを採用した理由

- `scripts/migrate.ts` が `drizzle-orm/bun-sql` の migrator で適用する。
  → 本番（ECS タスク）でも **`bun run` するだけ**で流せ、drizzle-kit も postgres.js も不要。
- `drizzle-kit migrate` は **Bun ネイティブ SQL ドライバに非対応**（`pg` / `postgres.js` を要求）。
  そのため CLI ではなくランタイムマイグレータを使う。

---

## Drizzle Studio（GUI）

- `pnpm db:studio` → ブラウザ（`https://local.drizzle.studio`）でテーブル閲覧・編集。
- **`postgres.js` を devDep で追加**している。理由: drizzle-kit（studio 含む）は Bun ドライバ
  非対応のため。**postgres.js は studio 専用**で、アプリ実行・マイグレーションは bun-sql のまま。
  - 住み分け: アプリ = bun-sql / マイグレーション = bun-sql / ローカル GUI = postgres.js（devDep）

---

## 環境変数

- **`DATABASE_URL`** を `.env` に置く。Bun は `.env` を自動読込。drizzle.config.ts は
  `import "dotenv/config"` で読む。
- **`.env`（実値・gitignore）と `.env.example`（雛形・commit）** に分ける。ローカルの接続情報は
  秘密ではないが、本番の秘密（RDS のパスワード等）は将来 **Secrets Manager 等から ECS タスクに注入**する。
  この「実行時は環境変数から」という作法を最初から通しておく。
