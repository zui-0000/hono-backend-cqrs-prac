import "./model/index.tsp";

@summary("RefreshResponse")
model RefreshResponse {
  accessToken: AccessToken;

  // NOTE: ローテーション (更新のたびに券ごと差し替える) のため、新しい券も返す。
  // 項目の追加なので既存クライアントは壊れない (知らない項目は無視される)。
  refreshToken: RefreshToken;
}
