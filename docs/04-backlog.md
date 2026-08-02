# 04. 積み残し

「あとでやる」と決めたものの置き場。**なぜ後回しにしたか**と、
**着手するとき何を見ればいいか**を残す（忘れるのは判断そのものより理由のほうなので）。

---

## テスト着手時に固定すべきこと

現在のテストは HTTP 境界の統合テストのみ（`src/__tests__/app.test.ts`, 14 ケース）。
**形が固まってからまとめて書く**方針。実際この判断は正しく機能していて、
プレゼンテーション層を 13 段階作り替えた際、HTTP 境界のテストは 1 行も変えずに通り続けた
（安定した縫い目にだけテストを置いているため）。

ただし、その過程で見つかった**繊細な挙動**は現時点で自動検証されていない。
テストを書くときは最低限これらを固定すること。

| 対象                          | 固定する挙動                                           | 壊れたときに起きること                         |
| ----------------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `checkMailAddressDuplication` | `excluding` に自分の id を渡すと重複と見なさない       | 「メールアドレスを変えない更新」が永久に 409   |
| `changeUserProfile`           | `updatedAt` だけ進み `createdAt` は据え置き            | 作成日時が更新のたびに書き換わる               |
| `changeUserProfile`           | 元の集約は書き換わらない（新しい値を返す）             | 呼び出し側が握っている集約に変更が波及する     |
| `handleWithEffect` の入力検証 | header / body / params / query が宣言どおり検証される  | **query は一度も実行されていない**（下記参照） |
| `handleWithEffect` の応答分岐 | `status: 204` は本文なし、それ以外は契約スキーマで検証 | 契約と異なる応答を返す                         |

### 一度も実行されていないコード

- **`validateQuery`** — クエリパラメータを使うエンドポイントがまだ無い（`listUsers` 未実装）。
  実装時が初回実行になる。あわせて `c.req.query()` が繰り返しパラメータの
  最初の 1 つしか返さない件（`validateQuery` の doc 参照）も、そのとき判断する。

### テストの限界（意図的に受け入れているもの）

`app.test.ts` はステータスと errorCode を `HttpStatus` / `ErrorCode` から参照している。
可読性を優先した判断だが、**定数の値そのものが変わったケースは検出できない**
（実装とテストが同じ定数を見るため）。契約（TypeSpec）と実装のステータス一致を
機械的に照合する仕組みは今のところ無い。

---

## 実装の積み残し

### `changePassword`（契約は定義済み）

`PUT /users/{id}/password`。契約・生成スキーマともに揃っているので、実装だけ。

**着手時の論点**: `currentPassword` の照合を**ドメインサービスに置くか command に置くか**。
メールアドレスの重複チェックは「集約をまたぐ業務ルール」なのでドメインサービスにしたが、
パスワード照合は `PasswordHasher`（技術サービス）が絡むため、**結論が変わる可能性がある**。

### `auth` コンテキスト（契約は定義済み）

`login` / `logout` / `refresh`。**初のコンテキスト跨ぎ**になるので、
`no-cross-context-internals` などの境界ルールがここで初めて実戦投入される。

> ⚠️ **着手前に思い出すこと**: `GetUserQueryService` はログインに使えない。
> 返すのは `name` / `mailAddress` だけで、**`id` も `hashedPassword` も含まない**
> （`GET /users/{id}` のための射影として意図的にそぎ落とした）。
> ログインは「メールアドレスで引く」「ハッシュを照合する」「id をトークンに載せる」の
> 3 つが必要なので、user 側に別のポートを用意する話になる。
> Customer/Supplier（使う側の要求を供給側が受けて公開する）の初適用。

### `listUsers`（契約が未定義）

`schema/src/contexts/users/index.tsp` に `listUsers` を足すところから。
`schema/src/shared/pagination/` の型（`CurrentPage` / `PerPage` / `TotalCount` / `TotalPages`）は
このために用意してある。応答は封筒ではなく `{ items, totalCount, ... }` という
それ自体が意味を持つオブジェクトになる（[`02-architecture.md`](02-architecture.md#一覧について)）。

---

## 先送りした判断

### 存在確認（`findById` → 404）の抽出

`new ResourceNotFoundError()` は現在 3 箇所。

```
application/update-user-command.ts    findById → Option.match
application/delete-user-command.ts    findById → Option.match
presentation/get-user-controller.ts   GetUserQueryService → Option.match  ← 経路が違う
```

前者 2 つは同じ形なので `findUserOrFail` として抽出できる。一度実装したが、
**2 箇所では抽出の根拠が弱い**（重複チェックと違い実装が完全に同一で、
取り違えの危険が無い）ため戻した。`changePassword` が 3 箇所目になった時点で再判断する。

なお 3 つ目（controller 側）は Query 経路なので、同じ関数では吸収できない。

### `process.env.DATABASE_URL!` の起動時検証

3 箇所（`shared/db/client.ts` / `drizzle.config.ts` / `scripts/migrate.ts`）で
非 null 断言を使っている。**型を黙らせているだけ**で、未設定なら `undefined` のまま
`drizzle()` に渡り、**最初のクエリまでエラーにならない**。
本番（ECS）で環境変数の設定漏れがあると、起動は成功してリクエストで落ちる。

### エラー応答が契約で検証されていない

成功応答は `handleWithEffect` が生成スキーマで検証してから返すが、
エラー応答は `c.json(response.body, ...)` でそのまま返している。
`ErrorBody` が TypeSpec のエラーモデルとズレても検出されない。

塞ぐなら `response` にエラー時のスキーマも宣言させることになるが、
エンドポイントごとに 4〜5 個列挙する必要があり、routes が大きく膨らむ。
エラーの形は 1 箇所（`errorBody`）でしか作られず、契約側の 6 モデルも
すべて同じ形なので、**費用対効果が見合わないと判断して見送った**。

### 未使用のエラークラス

`ConflictError` / `InternalServerError` / `UnauthorizedError` は一度も `new` されていない。
`UnauthorizedError` は auth で確実に使う。`ConflictError` は汎用 409 として出番がありうる。
`InternalServerError` は 500 を `RepositoryError` の翻訳経由で出しているため、
**直接 new する場面が無い可能性が高い**（auth 実装後も使われなければ削除を検討する）。

### `handleWithEffect` の型の複雑さ

マップ型・判別可能ユニオン・型述語を組み合わせており、後から触りにくい部類のコード。
ただしこれは**絶対的に必要な複雑さではなく、呼び出し側の簡潔さと引き換えに買ったもの**。

重荷になった場合の逃げ道: `request` の 4 入力源を必ず全部書かせ、使わないものは
`undefined` を渡す形にすれば、キーの絞り込み（`as K : never`）が不要になる。
呼び出し側は 1 エンドポイントあたり 2 行増える。

### CI

意図的に入れていない。**バックエンド設計の練習用リポジトリ**であり、
CI の構築自体は学習対象ではないため。品質ゲートは `pnpm lint:fix` を手で打つ運用。
