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
├─ error.ts           # SQLSTATE 判定ヘルパー
├─ drizzle.config.ts  # drizzle-kit 設定
├─ scripts/
│  └─ migrate.ts      # ランタイムマイグレータ（bun-sql）
└─ migrations/        # 生成 SQL + meta（git 管理）

src/contexts/<context>/infrastructure/
└─ drizzle-schema.ts  # そのコンテキストが所有するテーブル定義
```

- **`shared/db/` はテーブル定義を持たない**。ここに入るのは「物理 DB という 1 つの外部リソース」
  に関する共有物だけ（接続・エラー判定・マイグレーション基盤）。アダプタは各コンテキストにある。
- **テーブル定義は所有するコンテキストの `infrastructure/drizzle-schema.ts` に置く**。集約（`User`）と
  保存先（`t_user`）の所有者を揃えるため。共有の 1 ファイルに集約すると、他コンテキストが
  `db.update(tUser)` を直接書けてしまい、「書き込みは所有コンテキストの command を通す」という
  規約を構造が何も守らなくなる。分けておけば越境が import 文に現れ、lint で機械的に禁じられる。
- **物理 DB とマイグレーションは 1 つのまま**。drizzle-kit の `schema` は glob / 配列を取れるため
  （`"./src/contexts/*/infrastructure/drizzle-schema.ts"`）、ファイルを分けても migration は
  全テーブルをまとめて 1 系列（`out`）で管理できる。境界を跨ぐ FK も、
  相手コンテキストの `drizzle-schema.ts` を import すれば書ける（その依存が可視化されるのが利点）。
- **ドメインモデル（集約・値オブジェクト）は `contexts/<context>/domain/` に置く**。
  テーブル↔ドメインの変換は同じコンテキストの `infrastructure/` の repository が担う。

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
drizzle-schema.ts 編集
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

| script                           | 内容                                                            |
| -------------------------------- | --------------------------------------------------------------- |
| `pnpm db:generate --name <name>` | マイグレーション生成（`--name` は任意。省くとランダム語になる） |
| `pnpm db:migrate`                | 適用（`bun run src/shared/db/scripts/migrate.ts`）              |
| `pnpm db:studio`                 | GUI（`https://local.drizzle.studio`）                           |

### ファイル名はタイムスタンプ接頭辞

`drizzle.config.ts` で `migrations.prefix: "timestamp"` を指定している。

```text
20260801224553_create_t_user.sql    ← YYYYMMDDHHMMSS_<name>
```

連番（`0000_`）をやめた理由は、**ブランチを分けて作業したときに同じ番号が衝突する**から。
タイムスタンプなら衝突しない。

- 時刻は **UTC**。JST の朝に作ると前日の日付になる（07:42 JST = 前日 22:42 UTC）。
- **適用順を決めるのはファイル名ではなく `meta/_journal.json` の `idx`**。
  ファイル名は「いつ作ったか」を読むためのもの。
- `--name` は任意。付けなければ `20260801224553_black_spectrum.sql` のようなランダム語になる。
  順序はタイムスタンプが担うので、`--name` は後から読んで分かるようにするためだけの用途。

DB コンテナの起動 / 停止は `docker compose up -d` / `docker compose stop` を直接実行する（pnpm スクリプトにはしていない）。

### migrations は git 管理する

- **`drizzle-schema.ts` = 目的地、`migrations/` = そこへ至る道順**。既存データを壊さず変化させるには
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

## DB のエラーをどう扱うか

DB 由来の失敗は**性質の違う 2 種類**に分かれる。混ぜないことが要点。

|                         | 何が起きた                             | 扱い                             |
| ----------------------- | -------------------------------------- | -------------------------------- |
| **制約違反**（`23xxx`） | **業務ルールの違反**が DB で顕在化した | ドメインのエラーへ翻訳（409 等） |
| **それ以外**            | インフラの失敗                         | `RepositoryError`（500）         |

一意制約違反を `MailAddressAlreadyExistsError`（409）に翻訳しているのがひとつ目の例。
あれは「DB が壊れた」のではなく「同じメールアドレスの人が既に居た」であって、
**客に伝えるべき情報**。接続断と同じ袋に入れてはいけない。

### 内訳は型ではなくフィールドで持つ

インフラの失敗は最終的に全部 500 に丸まるが、**ログでは切り分けたい**
（「DB が落ちている」と「マイグレーション漏れ」が同じ行に見えるのは困る）。

そこで `RepositoryError` を分割せず、`failure` と `sqlState` を**フィールドとして持たせた**。

```ts
class RepositoryError extends Data.TaggedError("RepositoryError")<{
  readonly failure: RepositoryFailure; // unavailable / exhausted / contention / timeout / schema / data / unknown
  readonly sqlState?: string;
  readonly cause: unknown;
}> {}
```

**型で分けるのは、呼び出し側が違う扱いをするときだけ。** ここでは command も controller も
`handleErrorResponse` も全員が同じ扱い（500）をするので、型に出す理由がない。
3 つの型に割ると全 command のシグネチャが変わるが、誰も分岐しないので得るものが無い
（[`02-architecture.md`](02-architecture.md#ユースケースの入出力はそのコマンドクエリと同じファイルに置く) で
コマンドのエラー型に名前を付けなかったのと同じ判断）。

将来リトライを入れて**振る舞いが分岐したら**、そのとき型を検討する。

### 分類の仕方

`shared/db/error.ts` の `classifyDbFailure` が行う。判定の入り口は 2 つ。

| 例外の形        | 判定に使うもの                      | 例                                               |
| --------------- | ----------------------------------- | ------------------------------------------------ |
| SQLSTATE がある | `errno` の**クラス**（先頭 2 文字） | `42P01` → `schema`                               |
| SQLSTATE が無い | Bun 独自の `code`                   | `ERR_POSTGRES_CONNECTION_CLOSED` → `unavailable` |

**接続できないときも例外は `PostgresError` だが `errno` は入らない。**
サーバが何も返していないので当然だが、`errno` だけを見ていると
接続断が `unknown` に落ちる。実際に一度そうなった（DB を止めて確認して気付いた）。

クラスで括るのは、同じクラス内では原因の質が揃っているため（`08` はどれも「繋がらない」、
`53` はどれも「資源が足りない」）。例外は `57014`（`query_canceled`）で、
クラス `57` は「管理操作」だがこれだけは時間切れなので個別に見る。

### 検証

実 DB で確認済み。

| 起こし方            | 結果                                         |
| ------------------- | -------------------------------------------- |
| テーブル名を変える  | `failure=schema sqlState=42P01`              |
| DB コンテナを止める | `failure=unavailable`（`sqlState` は出ない） |

ログにはこう出る。`failure=schema` で検索すればマイグレーション漏れだけ拾える。

```text
level=ERROR message=リクエストの処理に失敗しました
  requestId=019fa5bc-... method=GET path=/users/... status=500
  errorTag=RepositoryError failure=schema sqlState=42P01 cause="..."
```

---

## 環境変数

- **`DATABASE_URL`** を `.env` に置く。Bun は `.env` を自動読込。drizzle.config.ts は
  `import "dotenv/config"` で読む。
- **`.env`（実値・gitignore）と `.env.example`（雛形・commit）** に分ける。ローカルの接続情報は
  秘密ではないが、本番の秘密（RDS のパスワード等）は将来 **Secrets Manager 等から ECS タスクに注入**する。
  この「実行時は環境変数から」という作法を最初から通しておく。
