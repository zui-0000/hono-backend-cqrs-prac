import type { ErrorCode } from "~/shared/error/error-code";

/**
 * 応答ボディの型 (TypeSpec の各モデルと対応)。
 *
 * 成功応答は封筒 (envelope) で包まず、リソースの内容をそのまま返す。
 * 以前は result / meta で包んでいたが、meta の中身 (respondedAt) は
 * HTTP の Date ヘッダと重複しており、相関 ID も X-Request-Id ヘッダで
 * 返しているため、封筒が情報を足していなかった。
 * そのため成功応答用の組み立て関数は無く、controller が素の値を返す。
 */

/** エラーの詳細 (TypeSpec の ErrorDetail と対応)。 */
export type ErrorDetailBody = {
  readonly field: string;
  readonly message: string;
};

/** エラー応答のボディ (TypeSpec の各 *Error モデルと対応)。 */
export type ErrorBody = {
  readonly errorCode: ErrorCode;
  readonly message: string;
  readonly details?: readonly ErrorDetailBody[];
};

/** エラー応答のボディを組み立てる。時刻を含まなくなったため純粋な関数。 */
export const errorBody = (params: {
  readonly errorCode: ErrorCode;
  readonly message: string;
  readonly details?: readonly ErrorDetailBody[];
}): ErrorBody => ({
  errorCode: params.errorCode,
  message: params.message,
  ...(params.details === undefined ? {} : { details: params.details }),
});
