import "./model/index.tsp";

@summary("LoginResponse")
model LoginResponse {
  accessToken: AccessToken;
  refreshToken: RefreshToken;
}
