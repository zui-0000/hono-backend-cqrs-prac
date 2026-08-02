import { Effect, ParseResult, Schema } from "effect";
import type { ParseError } from "effect/ParseResult";
import type { Context } from "hono";

import { BadRequestError } from "~/shared/errors/bad-request-error";

import type { ErrorDetailBody } from "./error-body";
import { ErrorMessage } from "./error-message";

/**
 * presentation 層の検証ユーティリティ。
 *
 * 「入力源ごとの検証」と「ユースケース入力の組み立て」を分けている。
 *
 * 入力源ごとの検証 (どれも API 契約の生成スキーマで検証する):
 *   - validateJson   … ボディ             `c.req.json()`
 *   - validateHeader … ヘッダ             `c.req.header()`
 *   - validateParams … パスパラメータ     `c.req.param()`   例: /users/:id の :id
 *   - validateQuery  … クエリパラメータ   `c.req.query()`   例: /users?page=2
 *
 * ユースケース入力の組み立て:
 *   - decodeInput    … 検証済みの値を合成し、値オブジェクトへ変換する
 *
 * 名前の注意: パスパラメータとクエリパラメータはどちらも「パラメータ」だが、
 * validateParams が扱うのは **パス** のほう。Hono 自身が `c.req.param()` /
 * `c.req.query()` と呼び分けており、生成スキーマも `GetUserParams` (パス) なので
 * それに揃えている。
 *
 * パスパラメータとボディを併用する、認証情報を混ぜる、ボディの一部だけ使う、
 * といった組み合わせにも対応できるよう、あえて 1 つの関数にまとめていない。
 *
 * いずれも errors: "all" で最初の違反では止めず、全フィールドの違反を集めたうえで、
 * ここで BadRequestError に変換する (Effect Schema の ParseError を層の外へ漏らさない)。
 */

const decodeOptions = { errors: "all" } as const;

/**
 * 検証エラーを「どのフィールドが、なぜ不正か」の一覧へ変換する。
 * ArrayFormatter は違反箇所の path とメッセージを構造化して返すため、
 * ネストしたフィールドは "meta.respondedAt" のようにドット区切りで表現する。
 * path が空 (ボディ全体が不正など) の場合は "-" とする。
 */
const toErrorDetails = (error: ParseError): readonly ErrorDetailBody[] =>
  ParseResult.ArrayFormatter.formatErrorSync(error).map((issue) => ({
    field: issue.path.length === 0 ? "-" : issue.path.join("."),
    message: issue.message,
  }));

/** スキーマで検証し、失敗を BadRequestError (違反フィールド付き) に変換する。 */
const decode = <A, I>(
  schema: Schema.Schema<A, I>,
  source: unknown,
): Effect.Effect<A, BadRequestError> =>
  Schema.decodeUnknown(
    schema,
    decodeOptions,
  )(source).pipe(
    Effect.mapError(
      (error) =>
        new BadRequestError({
          message: ErrorMessage.BadRequest,
          details: toErrorDetails(error),
        }),
    ),
  );

/** リクエストボディを JSON として取得し、API 契約スキーマで検証する。 */
export const validateJson = <A, I>(
  c: Context,
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, BadRequestError> =>
  Effect.gen(function* () {
    const raw = yield* Effect.tryPromise({
      try: () => c.req.json(),
      catch: () =>
        new BadRequestError({
          message: ErrorMessage.MalformedJson,
        }),
    });
    return yield* decode(schema, raw);
  });

/**
 * リクエストヘッダを API 契約スキーマで検証する (X-Request-Id など)。
 *
 * HTTP のヘッダ名は大文字小文字を区別しない。Hono は小文字に正規化して返すため、
 * 契約 (OpenAPI が定義するヘッダ名) が期待するキーへ揃えてから検証する。
 * headerNames には契約上のヘッダ名 (例: "X-Request-Id") を渡す。
 */
export const validateHeader = <A, I>(
  c: Context,
  schema: Schema.Schema<A, I>,
  headerNames: readonly string[],
): Effect.Effect<A, BadRequestError> => {
  const received = c.req.header();
  const source = Object.fromEntries(
    headerNames.map((name) => [name, received[name.toLowerCase()]]),
  );
  return decode(schema, source);
};

/** パスパラメータを API 契約スキーマで検証する。 */
export const validateParams = <A, I>(
  c: Context,
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, BadRequestError> => decode(schema, c.req.param());

/**
 * クエリパラメータを API 契約スキーマで検証する。
 *
 * `c.req.query()` は繰り返し指定 (`?tag=a&tag=b`) のうち **最初の 1 つだけ** を返す。
 * 配列で受けたい契約を作る場合は `c.req.queries()` に切り替える必要がある
 * (現時点の契約に繰り返しパラメータは無いため query() で足りている)。
 */
export const validateQuery = <A, I>(
  c: Context,
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, BadRequestError> => decode(schema, c.req.query());

/**
 * 検証済みの値を合成してユースケースの入力へ変換する (値オブジェクト化・正規化)。
 * 入力源が複数ある場合は呼び出し側で組み立てた 1 つのオブジェクトを渡す。
 */
export const decodeInput = <A, I>(
  schema: Schema.Schema<A, I>,
  source: unknown,
): Effect.Effect<A, BadRequestError> => decode(schema, source);
