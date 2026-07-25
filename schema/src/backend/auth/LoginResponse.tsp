import "../../shared/model/index.tsp";
import "./LoginResult.tsp";

@summary("LoginResponse")
model LoginResponse {
  result: LoginResult;
  meta: CommonResponseMeta;
}
