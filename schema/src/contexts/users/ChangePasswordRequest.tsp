import "./model/index.tsp";

@summary("ChangePasswordRequest")
model ChangePasswordRequest {
  // 現在のパスワード。本人確認 (セッション乗っ取り対策) のため必須。
  currentPassword: Password;

  newPassword: Password;
}
