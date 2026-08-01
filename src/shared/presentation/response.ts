import { Effect } from "effect";
import type { ErrorCode } from "~/shared/error/error-code";
import { now } from "~/shared/service/clock";

/** 全レスポンス共通のメタ情報 (TypeSpec の CommonResponseMeta と対応)。 */
export type ResponseMeta = {
  readonly respondedAt: string;
};

/** エラーの詳細 (TypeSpec の ErrorDetail と対応)。 */
export type ErrorDetailBody = {
  readonly field: string;
  readonly message: string;
};

/** エラー応答のボディ (TypeSpec の各 *Error モデルと対応)。 */
export type ErrorBody = {
  readonly errorCode: ErrorCode;
  readonly message: string;
  readonly meta: ResponseMeta;
  readonly details?: readonly ErrorDetailBody[];
};

/** 現在時刻から共通メタを組み立てる (時刻は Clock 経由)。 */
export const responseMeta: Effect.Effect<ResponseMeta> = Effect.map(
  now,
  (respondedAt) => ({ respondedAt: respondedAt.toISOString() }),
);

/** 結果 (result) とメタを持つ成功応答のボディを組み立てる。 */
export const successBody = <A>(
  result: A,
): Effect.Effect<{ readonly result: A; readonly meta: ResponseMeta }> =>
  Effect.map(responseMeta, (meta) => ({ result, meta }));

/** メタのみの成功応答のボディを組み立てる (作成・更新など result を返さない場合)。 */
export const metaOnlyBody: Effect.Effect<{ readonly meta: ResponseMeta }> =
  Effect.map(responseMeta, (meta) => ({ meta }));

/** エラー応答のボディを組み立てる。 */
export const errorBody = (params: {
  readonly errorCode: ErrorCode;
  readonly message: string;
  readonly details?: readonly ErrorDetailBody[];
}): Effect.Effect<ErrorBody> =>
  Effect.map(responseMeta, (meta) => ({
    errorCode: params.errorCode,
    message: params.message,
    meta,
    ...(params.details === undefined ? {} : { details: params.details }),
  }));
