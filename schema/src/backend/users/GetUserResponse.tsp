import "../../shared/model/index.tsp";
import "./GetUserResult.tsp";

@summary("GetUserResponse")
model GetUserResponse {
  result: GetUserResult;
  meta: CommonResponseMeta;
}
