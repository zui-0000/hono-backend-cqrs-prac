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
│  ├─ domain/           # 共有カーネル。model/ が語彙（uuid.ts + value-objects/）、
│  │                    #   直下はドメインが環境から得るもの（時刻 / 採番 / ハッシュ化）
│  ├─ application/      # ユースケースの共通部品（orNotFound）。層で切った並びの一員
│  ├─ errors/           # 型付きエラー（Data.TaggedError）
│  ├─ presentation/     # ハンドラ / 検証 / エラー翻訳 / リクエストログ の共通基盤
│  │  └─ constants/     #   API が外に見せる語彙。公開するのが `as const` の表と
│  │                    #   派生型だけのファイルを置く（振る舞いを持つものは直下）
│  ├─ infrastructure/   # 横断ポートの本番実装（Layer）。合成ルートだけが参照する
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

**ファイル名は主となるエクスポート名に対応させる**（`value-objects/user-id.ts` → `UserId`）。
同じユースケースに属する型は同じファイルに同居してよい
（`create-user-command.ts` → `createUserCommand` / `CreateUserCommandInput` /
`CreateUserCommandOutput`）。名前に接頭辞が付いているので、どれがどのファイルかは名前で読める。

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

## ユースケースの入出力は、そのコマンド／クエリと同じファイルに置く

`application/` は **1 ファイル = 1 ユースケース**。入出力の型を集めた `dto.ts` を
一度は置いたが、畳んでそれぞれのコマンド／クエリへ展開した。

理由は、`dto.ts` が**この層で唯一の例外**だったから。ユースケースが増えるほど
「入力を直すのに 2 ファイル開く」が積み上がり、逆に `dto.ts` を開いても
どのユースケースの話かは名前でしか分からない。
凝集の単位はユースケースであって「DTO であること」ではない。

副産物として `application/` に補助的なファイルを置く言い訳が消えた。
共通部品（`orNotFound`）を `shared/application/` に出したのはこの規則を保つため。

入力と出力で作りが異なる点は変わらない。

- **入力**は Effect Schema で定義する。値オブジェクトのスキーマを組み合わせるため、
  presentation は生の入力を一度 `decodeInput` するだけで検証済みの値を得られる
  （フィールドごとの詰め替えが要らない）。
- **出力**はプレーンな型で定義する。既に検証済みの値を返すだけで decode は不要だし、
  応答が契約を満たすかは presentation 層が生成スキーマで検証するので二重に検証しない。

応答ボディの「形」（`{ id: ... }` のようなラップ）は契約側の関心なので持ち込まない。
presentation が契約の形へ詰め替える。

---

## ポートは、それを要求する層に置く

`Context.Tag` で宣言するポートは、**それを必要とする層の中**に置く。実装だけが
`infrastructure/` に出る。`domain-not-to-outer` の違反メッセージに書いてあるとおり
「必要なのが副作用なら `domain/` にポートを定義し、実装は `infrastructure/` に置いて
`Layer` で注入する」——この規約はコンテキストの中でも `shared/` でも同じ。

```text
contexts/user/domain/                shared/domain/
├─ model/              語彙          ├─ model/               語彙
│  ├─ user.ts                        │  ├─ uuid.ts
│  └─ value-objects/                 │  └─ value-objects/
├─ services/           業務ルール    ├─ clock.ts             ┐
└─ user-repository.ts  ← 直下        ├─ password-hasher.ts   ├ ← 直下
                                     └─ uuid-generator.ts    ┘
```

**規約は 1 行で言える** — `model/` は語彙、`services/` は業務ルール、
**直下に置かれるのはドメインが環境から得るもの**。`contexts/<ctx>/domain/` で
`user-repository.ts` が直下に転がっているのと同じ枠で、`shared/` 側もそれに揃えた。

### 「ポート」という語について

`Context.Tag` で宣言するものを、このリポジトリでは散文で「ポート」と呼ぶ。
ただし**これはヘキサゴナルアーキテクチャ（Ports and Adapters）の語彙**であって、
DDD でも Effect でもない。Effect 自身は **Service**（部品）/ **Tag**（識別子）/
**Layer**（構築）と呼び、`R` は requirements。

| このリポジトリ | Effect         | ヘキサゴナル |
| -------------- | -------------- | ------------ |
| ポート         | Service（Tag） | Port         |
| `*Live`        | Layer          | Adapter      |
| 依存           | Requirements   | —            |

**説明の言葉として借りるのは構わないが、ディレクトリ名にはしない。**
散文の「ポート」は読み手の理解を助けるだけだが、ディレクトリ名にすると
「全員がそこへ物を仕分ける基準」になる。基準は自分たちの語彙
（DDD の `model` / `services` / `value-objects`）で持つ。

そのため `shared/domain/ports/` は作らず、直下に置いて
「直下 = 環境から得るもの」という位置で語らせている。
`clock.ts` が Tag を宣言していない（時刻の抽象化は Effect の `Clock` が持つ）ことも、
この分け方なら例外にならない。**Tag の有無は「どうやって」の話**で、
「何であるか」の分類軸には使わない。

横断サービス（時刻・採番・ハッシュ化）は当初 `shared/services/` に置いていたが、
`shared/domain/` に移した。理由は 2 つ。

1. **3 つとも `contexts/<ctx>/domain/` から使われている。** 時刻と採番は集約の生成に、
   ハッシュ照合は `verifyUserPassword` に要る。ドメインが要求するものを
   ドメインの外に置いていたことになる。
2. **`services` が層でもトピックでもない名前だった。** これを畳むと `shared/` の直下は
   層の名前 4 つ（domain / application / infrastructure / presentation）と
   トピック 2 つ（errors / db）だけになる。

`shared/domain/services/` にしなかったのは、`services` が 2 つの意味を持ってしまうから。
コンテキスト側の `domain/services/` は**集約をまたぐ業務ルール**の置き場で、技術ポートとは
別物。そしてその枠は、`auth` が来て「コンテキストをまたぐ業務ルール」が現れたときのために
空けておきたい。

> 以前は逆の判断をしていた（「共有カーネルは Schema だけに依存する純粋な語彙で揃える」）。
> 覆した理由は、`contexts/<ctx>/domain/` が最初から語彙（`model/`）と
> R を持つポート（`user-repository.ts`）を同居させており、**その混在こそが既定の形**
> だったから。「純粋な語彙だけ」は原則ではなく、当時の中身の説明にすぎなかった。

### `model/` の中は brand の有無で分ける

| 中身                       | 見分け方                     | 置き場                 | 例                         |
| -------------------------- | ---------------------------- | ---------------------- | -------------------------- |
| **語彙**（値オブジェクト） | `Schema.brand` を持つ        | `model/value-objects/` | `MailAddress` / `Password` |
| **形式**（語彙の素材）     | Schema だが brand を持たない | `model/` 直下          | `Uuid`                     |

`Uuid` は **refinement（制約）だけを持ち、brand を持たない**スキーマなので、
`value-objects/` には入れていない。

```ts
Uuid        = Schema.String.pipe(Schema.pattern(...));                    // 制約のみ
MailAddress = Schema.String.pipe(Schema.pattern(...), Schema.brand(...)); // 制約 + 名目型
```

**制約は「この文字列がどういう形か」を言い、brand は「これが何者か」を言う。**
`Uuid` は形しか言っていないので、単体では何の id かを意味しない。`UserId` と
`OrderId` は同じ形の別物で、その「別物」を作っているのは brand のほう
（`UserId = Uuid.pipe(Schema.brand("User.Id"))`）。

`Uuid` 自身に brand を付けないのはそのため。付けると brand の二重掛けになり、
かつ素の `Uuid` が id を期待する場所へ流れ込めてしまう。

形式が 1 つしかないうちはディレクトリを切らない。上の 2 つを見れば分類できるので、
ディレクトリに分類を語らせる必要がないため。2 つ目の「brand を持たないスキーマ」が
現れたら、そのとき `formats/` なりを切る。

---

## 書き込みポートは、集約ではなく状態遷移に対応させる

`UserRepository` の更新系は、ドメインの状態遷移と 1 対 1 に並べる。

```text
createUser          → create
changeUserProfile   → updateProfile    （name / mailAddress / updatedAt を書く）
changeUserPassword  → updatePassword   （hashedPassword / updatedAt を書く）
```

集約まるごとを書く `update` を 1 つ持っていたが、**その操作が変えないはずの列まで
書き戻していた**。集約を読んでから書くまでの間に他の誰かがプロフィールを変えていれば、
パスワード変更がそれを巻き戻す（ロストアップデート）。逆向きも同様で、
プロフィール更新が変更直後のパスワードを古いハッシュへ戻しうる。**後者は
「漏れたから変えた」パスワードが黙って復活する**という、より危険な形になる。

実 DB で再現させて確認した。`changePassword` は argon2 の照合とハッシュで
100ms 前後かかるため、その最中にプロフィールを更新すると再現する。
分けたあとは巻き戻らない。発行される SQL も互いの列に触れていない。

副産物として、**失敗の型が操作ごとに正確になる**。メールアドレスを書かない
`updatePassword` に一意制約違反は起こりえず、`E` にも現れない。分ける前は
「起こりえないが型には出る 409」を `Effect.die` で潰す必要があり、
なぜ潰すのかという説明をコメントで背負っていた。**型が嘘をつくのをやめれば、
その説明ごと消える。**

### 残る穴と、その引き金

同じ列への同時更新は後勝ちのまま（同時に 2 回パスワードを変えたら片方が勝つ）。
検出するにはバージョン列（楽観ロック）が要る。今それを入れないのは、
**列単位に書き分けている限り、守るべき不変条件が列をまたがないから**。

見直す引き金は「複数の列にまたがる不変条件ができたとき」。
そうなると列ごとの書き分けでは整合を守れず、集約単位の排他が要る
（詳細は [`04-backlog.md`](04-backlog.md)）。

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

この「Option を 404 に変える」は 3 箇所（`updateUser` / `deleteUser` / `changePassword`）に
現れたため `shared/application/or-not-found.ts` に切り出した。
`findUserOrFail`（リポジトリを内側に持つ形）にしなかったのは、それだと
コマンド経路しか吸収できず、同じ形の判断をしている `getUserController`（Query 経路）が
残ってしまうから。変換だけを切り出せば経路を問わず使え、
結果として user コンテキスト固有でもなくなる。

### 業務ルールでも、集約に置くもの

ドメインサービスは「エンティティにも値オブジェクトにも属さない操作」の受け皿であって、
**業務ルールの既定の置き場ではない**。単一の集約を見れば答えが出る問いは集約に置く。

例: `verifyUserPassword`（渡された平文が、このユーザーの現在のパスワードか）。
これはビジネス側に聞ける問い（「パスワード変更時に現在のパスワードを確認しますか？」）
なので業務ルールだが、`User` 1 つを見れば判定できるためドメインサービスにはしない。

判断の順序はこうなる。

1. ビジネス側に聞ける問いか → いいえなら command（ユースケースの方針）
2. 集約 1 つを見て答えられるか → はいなら集約（`domain/model/`）
3. どちらでもない（集約をまたぐ）→ ドメインサービス（`domain/services/`）

技術サービス（`PasswordHasher`）が要るかどうかは判断材料にしない。
`createUser` が `UuidGenerator` を、`changeUserProfile` が `Clock` を要求するのと同じく、
必要な副作用は戻り値の `R` に現れるだけで、置き場所を変える理由にはならない。

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

### 失敗の出口は 2 つだけ

応答が契約の形を保つ経路は 2 本しかなく、どちらも `handleWithEffect` にある。

| 失敗の種類                   | 出口                                 | 外に出るもの                 |
| ---------------------------- | ------------------------------------ | ---------------------------- |
| 型付きエラー（`E` チャネル） | `handleErrorResponse` + `logFailure` | 契約の errorCode と定型文    |
| defect（`orDie` / `die`）    | `logDefect` + `defectResponse`       | 契約の 500（原因は出さない） |

**defect は `catchAll` をすり抜ける**ので、受け皿が無いと `runPromise` が reject し、
Hono 既定の平文 `Internal Server Error` が返る。契約と違う形になるうえ、
`logFailure` も走らないので**相関 ID の付いたログが 1 行も残らない**。
「問い合わせ番号からログを引く」という設計が、そこだけ効かなくなる。

受け皿を 1 箇所に置いてあるので、`orDie` はどこで使ってもこの経路を通る
（応答スキーマ違反 / DB 行の復元失敗 / ハッシュ形式の破れ / 起こりえない一意制約違反）。
**「起きたらバグ」を `orDie` で表明してよいのは、この出口があるから。**

### 一覧について

フラットにしても将来の `listUsers` は困らない。一覧は
`{ items: [...], totalCount, currentPage }` のような**それ自体が意味を持つオブジェクト**に
なるので、封筒とは別物（`schema/src/shared/pagination/` の型がそのため）。
