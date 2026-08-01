import { Effect, ParseResult, Schema } from "effect";
import type { ParseError } from "effect/ParseResult";
import type { Context } from "hono";

import { BadRequestError } from "~/shared/error/bad-request-error";

import type { ErrorDetailBody } from "./response";

/**
 * presentation 層の検証ユーティリティ。
 *
 * 「入力源ごとの検証」と「ユースケース入力の組み立て」を分けている:
 *   - validateJson / validateParams / validateQuery … 各入力源が API 契約を満たすか
 *   - decodeInput                                   … 検証済みの値を合成してユースケース入力へ
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
          message: "リクエスト内容が不正です",
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
          message: "リクエストボディを JSON として解釈できません",
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

/** クエリパラメータを API 契約スキーマで検証する。 */
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
