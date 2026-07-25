@summary("Password")
@doc("パスワード(平文)。入力専用で、レスポンスに含めないこと。")
@example("********")
@minLength(8)
@maxLength(72)
scalar Password extends string;
