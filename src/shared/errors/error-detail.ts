/**
 * エラーの詳細 (フィールド単位の指摘)。TypeSpec の ErrorDetail と対応。
 *
 * 特定のエラーに属する語彙ではないため独立したファイルに置く
 * (契約側も schema/src/shared/error/ErrorDetail.tsp として独立している)。
 * 現状 details を持つのは BadRequestError だけだが、
 * 「どのフィールドが、なぜ駄目か」を返したいエラーは他にも出うる。
 */
export type ErrorDetail = {
  readonly field: string;
  readonly message: string;
};
