import "../../shared/model/index.tsp";
import "./RefreshResult.tsp";

@summary("RefreshResponse")
model RefreshResponse {
  result: RefreshResult;
  meta: CommonResponseMeta;
}
