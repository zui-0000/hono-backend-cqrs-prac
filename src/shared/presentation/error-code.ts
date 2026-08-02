/**
 * API のエラーコード体系。
 * `<HTTP ステータス><連番>` の 4 桁で、下 1 桁 0 が各ステータスの汎用エラー、
 * 1 以降が具体的な事由を表す専用エラー。TypeSpec の ErrorCode と対応する。
 */
export const ErrorCode = {
  /** 400 リクエスト内容が不正 (汎用) */
  BadRequest: "4000",
  /** 401 認証情報が不正 (汎用) */
  Unauthorized: "4010",
  /** 404 リソースが存在しない (汎用) */
  ResourceNotFound: "4040",
  /** 409 リソースの現在の状態と衝突する (汎用) */
  Conflict: "4090",
  /** 409 メールアドレスが既に使用されている */
  MailAddressAlreadyExists: "4091",
  /** 500 サーバー内部で予期せぬエラーが発生した (汎用) */
  InternalServerError: "5000",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
