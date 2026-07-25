# hono-cqrs-prac

Hono + CQRS + DDD を学習するためのバックエンド（Bun ランタイム）。

## 技術スタック

| 領域               | 採用                                       |
| ------------------ | ------------------------------------------ |
| ランタイム         | Bun                                        |
| Web フレームワーク | Hono                                       |
| パッケージ管理     | pnpm                                       |
| ツールチェーン管理 | mise（Bun / pnpm / Node のバージョン固定） |
| DB                 | PostgreSQL 18（Docker）                    |
| ORM                | Drizzle（`bun-sql` ドライバ）              |
| Lint / Format      | oxlint / oxfmt                             |
| 言語               | TypeScript                                 |

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

# 4. 開発用 PostgreSQL を起動
pnpm db:up

# 5. マイグレーションを生成（スキーマ変更時。初回 clone は既存 migration があるので省略可）
pnpm db:generate --name <name>

# 6. マイグレーションを適用（t_user 等を作成）
pnpm db:migrate
```

## 起動

```zsh
pnpm dev
```

- `http://localhost:3000/` … `Hello Hono on Bun!`
- `http://localhost:3000/health` … `{"status":"ok"}`

## スクリプト

| script                           | 内容                                      |
| -------------------------------- | ----------------------------------------- |
| `pnpm dev`                       | 開発サーバ（ホットリロード）              |
| `pnpm start`                     | 通常起動                                  |
| `pnpm check:types`               | 型チェック（`tsc --noEmit`）              |
| `pnpm check:lint`                | oxlint                                    |
| `pnpm check:updates`             | 依存の更新確認                            |
| `pnpm format:check`              | 整形チェック（oxfmt）                     |
| `pnpm format:fix`                | 整形適用                                  |
| `pnpm lint:fix`                  | lint 自動修正 → 整形 → 型チェック（一括） |
| `pnpm db:up` / `db:stop`         | 開発用 Postgres の起動 / 停止             |
| `pnpm db:generate --name <name>` | マイグレーション生成（TS スキーマ → SQL） |
| `pnpm db:migrate`                | マイグレーション適用                      |
| `pnpm db:studio`                 | Drizzle Studio（GUI）                     |

## ディレクトリ構成

```text
src/
├─ main.ts              # エントリ（Hono + Bun）
├─ features/            # bounded context 単位（package by feature）
│  └─ <context>/        #   例: user
│     ├─ domain/        #     集約 / 値オブジェクト / リポジトリ IF
│     ├─ application/   #     command / query（CQRS）
│     ├─ infrastructure/#     リポジトリ実装（domain ↔ DB 変換）
│     └─ presentation/  #     Hono ルーター
└─ shared/
   └─ db/               # Drizzle クライアント / スキーマ / マイグレーション
docs/                   # 設計と学びの記録
```

- ドメインモデルは feature ごとに per-context で保持。テーブル定義（Drizzle スキーマ）は
  共有インフラとして `src/shared/db/schema.ts` に集約する。

## ドキュメント

- [`docs/01-database.md`](docs/01-database.md) — DB 周りの設計と運用（なぜその選択をしたか）
