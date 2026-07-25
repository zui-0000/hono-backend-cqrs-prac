@summary("RefreshToken")
@doc("リフレッシュトークン(不透明トークン想定)。アクセストークン再発行に使用する。")
@example("rt_2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f")
@minLength(20)
@maxLength(2048)
// NOTE: 実装都合で形式を変えられるよう、JWTのような強い制約は付けない
scalar RefreshToken extends string;
