# 02. 構造と命名の規約

ディレクトリの切り方・命名・API 応答の形について、**なぜそうしたか** を残す。
ここに書いた規約の多くは lint で機械的に強制している（[`03-boundary-enforcement.md`](03-boundary-enforcement.md)）。

---

## ディレクトリ構成

```text
schema/                 # TypeSpec による API 契約（OpenAPI 3.1 を出力）
src/
├─ main.ts              # エントリ（Bun）。本番の Layer から runtime を作り app に注入
├─ app.ts               # コンテキストをパスにマウントするだけ（1 コンテキスト 1 行）
├─ app-runtime.ts       # 合成ルート。各 *-layer.ts を束ねる（contexts を知る唯一の層）
├─ contexts/            # 境界づけられたコンテキスト単位で縦に切る
│  └─ <context>/        #   例: user / auth
│     ├─ <ctx>-layer.ts   #   提供側: このコンテキストの実装（infrastructure を知る）
│     ├─ <ctx>-runtime.ts #   要求側: 動かすのに必要なサービス（ポートだけを知る）
│     ├─ domain/        #     model/（集約 + value-objects/）, services/（ドメインサービス）, ポート
│     ├─ application/   #     command / query（CQRS）
│     ├─ infrastructure/#     テーブル定義 / リポジトリ実装（domain ↔ DB 変換, Layer）
│     └─ presentation/  #     <ctx>-routes.ts（HTTP 契約の宣言）+ controller
├─ shared/
│  ├─ domain/           # コンテキストを跨ぐ値オブジェクト（Uuid / MailAddress / Password）
│  ├─ errors/           # 型付きエラー（Data.TaggedError）
│  ├─ presentation/     # ハンドラ / 検証 / エラー翻訳 / リクエストログ の共通基盤
│  │                    #   + API が外に見せるコード体系（http-status / error-code）
│  ├─ services/         # 横断サービス（採番・ハッシュ化）のポートと実装
│  └─ db/               # Drizzle クライアント / マイグレーション基盤（テーブル定義は持たない）
├─ __tests__/           # テストは対象と同階層の __tests__ に置く（コロケーション）
└─ generated/           # orval が OpenAPI から生成（gitignore, prepare で再生成）
docs/                   # 設計と学びの記録
```

要点を先に挙げると:

- **依存の向きは常に内向き。** 「どの実装を使うか」を知るのは `src/app-runtime.ts`（合成ルート）だけ。
  controller は `createApp(runtime)` 経由でランタイムを受け取るため、テストでは Layer を
  差し替えて DB なしで HTTP 境界ごと検証できる。
- **コンテキストを跨ぐ参照はポート（`domain/`・`application/` の interface）に限る。**
  他コンテキストの `infrastructure/` は直接 import しない。書き込みは必ず所有コンテキストの
  command を通す。
- **バレル（再エクスポート専用の `index.ts`）は置かない**（`src` 配下に 0 個）。
  代わりにエクスポート名を単体で読める形にする（`UserId` / `createUser` / `UserRepositoryLive`）。
- **上記はすべて lint で強制している。** 破ると `pnpm lint:fix` が落ちる
  （[`03-boundary-enforcement.md`](03-boundary-enforcement.md)）。

以下、それぞれの判断の理由。

---

## なぜ `features/` ではなく `contexts/` か

**コンテキストどうしが関係を持つのを前提にするため。**

フロントエンド（React 等）でよく使う `features/` は「独立した機能の縦切り」という含意が強い。
バックエンドでは `auth` が `user` を参照するような**跨ぎが必ず起きる**ので、その含意は嘘になる。

`contexts/`（境界づけられたコンテキスト）なら、DDD の文脈マッピングで関係を説明できる。
例: `auth → user` は Customer/Supplier（使う側の要求を、供給側がポートとして公開する）。

跨ぐこと自体は禁止しない。**跨ぎ方だけ**を縛る — 参照してよいのはポート
（`domain/`・`application/` の interface）だけで、他コンテキストの `infrastructure/` や
`presentation/` は触らない。書き込み（集約の変更）は必ず所有コンテキストの command を通す。

---

## バレルを置かない

**再エクスポート専用の `index.ts` は `src` 配下に 0 個。**

置かない理由:

- **import 経路が二重化する。** 実際、バレルがあった頃は `domain/user-repository.ts` だけが
  `./model/user` を直接参照し、他は `./model`（バレル）を経由していた。同じ型に 2 本の道ができる。
- **`export *` が公開面を隠す。** 何がどこから来ているのかが import 文だけでは読めなくなる。

ディレクトリは「公開 API」ではなく、**単なる置き場所**として扱う。

### 代わりに、エクスポート名を単体で読める形にする

バレルが無いぶん、名前空間（`import * as User`）で文脈を補えない。名前自体に文脈を持たせる。

```ts
User / UserId / UserName / UserHashedPassword / createUser / changeUserProfile;
```

修飾しないと、コンテキストが増えたとき `Id` や `Model` が衝突して別名 import 地獄になる。

**ファイル名はエクスポート名に対応させる**（`value-objects/user-id.ts` → `UserId`）。
複数の定義を持つカテゴリファイル（`dto.ts` など）は例外。

### ただしタグ文字列は一致させなくてよい

brand / DI / エラーのタグは、**グローバル一意でありさえすればよい識別子**。
型解決には関与しないので、読みやすい表記を自由に選べる。

```ts
export const UserId = Uuid.pipe(Schema.brand("User.Id"));
//           ^^^^^^ エクスポート名は修飾            ^^^^^^^ タグはドット区切りのまま
```

---

## `infrastructure/` の命名

**何であるかによって修飾の仕方を変える。**

### ポートの実装 → 「ポート名 + `Live`」

```text
domain/user-repository.ts              ポート
infrastructure/user-repository-live.ts 実装（export: UserRepositoryLive）
```

ポートと実装がまったく同じファイル名になるのを避ける（エディタのファイル検索で見分けがつかない）。
かつ、ファイル名＝エクスポート名の規約も保てる — `UserRepositoryLive` を kebab 化すると
そのまま `user-repository-live.ts` になる。

`Live` は本番用 Layer を指す Effect の慣習で、`PasswordHasherLive` などと語が揃う。

### ポートを持たない技術固有の資産 → 「技術名」

```text
infrastructure/drizzle-schema.ts   テーブル定義（export: tUser）
```

抽象の裏に隠れていない Drizzle むき出しの資産であること、および `schema` という語が
このリポジトリで多義であることの両方に対処する:

| 「schema」が指すもの                  | 場所                       |
| ------------------------------------- | -------------------------- |
| API 契約（TypeSpec）                  | リポジトリ直下の `schema/` |
| Effect Schema（値オブジェクト・検証） | `src` の多数のファイル     |
| 生成された Effect Schema              | `src/generated/`           |
| ネームスペース                        | PostgreSQL の用語          |

---

## テーブル定義は所有するコンテキストが持つ

`shared/db/schema.ts` に全テーブルを集約するのをやめ、
`contexts/<context>/infrastructure/drizzle-schema.ts` に分けた。

**集約（`User`）と保存先（`t_user`）の所有者を揃えるため。** 共有の 1 ファイルに集約すると、
他コンテキストが `db.update(tUser)` を直接書けてしまい、「書き込みは所有コンテキストの
command を通す」という規約を構造が何も守らなくなる。分けておけば越境が import 文に現れ、
lint で機械的に禁じられる。

**物理 DB とマイグレーションは 1 つのまま**（`shared/db/`）。drizzle-kit の `schema` は
glob を取れるため、ファイルを分けても migration は 1 系列で管理できる。
詳細は [`01-database.md`](01-database.md)。

---

## ドメインサービス（`domain/services/`）

**集約をまたぐ業務ルール**を置く。集約 1 つを見ても判断できない不変条件は、
エンティティにも値オブジェクトにも属さないため（Evans の Service の定義）。

例: `checkMailAddressDuplication` —「同じメールアドレスのユーザーは 2 人存在しない」。
`User` 集約 1 つを見ても「他に同じメアドの人が居るか」は判断できない。

ルールに名前を与えて 1 箇所に集め、**「呼ぶ順序」だけを command に残す**。
依存するのは `domain/` のポートだけなので、層の向きは内向きのまま保たれる
（I/O を伴うことは戻り値の `R` に現れる）。

### command に残すもの

「対象が居なければ 404」のような**ユースケースごとの方針**は command に残す。
これは業務ルールではない — ビジネス側に「同じメアドの人が 2 人居ていいですか？」は聞けるが、
「存在しない ID を指定されたらどうしますか？」は業務の問いではない。

### 命名: `check<対象>Duplication`

一意性の検証はこの形に統一する（例: `checkMailAddressDuplication`）。

- 失敗するかどうか・何で失敗するかは **Effect の型（`E` チャネル）が語る**ので、
  名前は「何を見るか」だけを言う。`ensure` は .NET/Rust では「満たさなければ落とす」だが
  Go/k8s では「無ければ作る」を意味し、さらに Effect には別物の `ensuring`
  （ファイナライザ）があるため避けた。
- `validate*` は presentation 層の契約スキーマ検証（`validateJson` / `validateParams`）で
  使うため避ける。

---

## API 応答を封筒（envelope）で包まない

リソースの内容をそのまま返す。

```jsonc
// 200 GET /users/{id}
{ "name": "アスカ", "mailAddress": "asuka@example.com" }
// 201 POST /users
{ "id": "019fbf41-5fcd-7000-b147-14f2ed63cf2f" }
// エラー
{ "errorCode": "4040", "message": "指定されたユーザーは存在しません" }
```

以前は `result` / `meta` で包んでいたが、`meta` の中身（`respondedAt`）は HTTP の
`Date` ヘッダと重複しており、相関 ID も `X-Request-Id` ヘッダで返しているため、
**封筒が情報を何も足していなかった**。

副産物として、`errorBody` から時刻取得が消えて純粋な関数になり、連鎖して
`handleErrorResponse` も `Effect` を返す必要がなくなった。エラー翻訳はもともと
純粋な対応表（タグ → ステータス + errorCode）で、`Effect` を被っていた唯一の理由が
`respondedAt` の時刻取得だった。

### `createUser` が id を返すこと

CQRS の「コマンドは値を返さない」原則に対する**意図的な例外**。

採番はサーバー側でしか決まらず、返さないとクライアントは作ったリソースを二度と
参照できない（`GET /users/{id}` を呼べない）。集約そのものは外に出さない。

### 一覧について

フラットにしても将来の `listUsers` は困らない。一覧は
`{ items: [...], totalCount, currentPage }` のような**それ自体が意味を持つオブジェクト**に
なるので、封筒とは別物（`schema/src/shared/pagination/` の型がそのため）。
