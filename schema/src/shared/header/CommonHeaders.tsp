import "@typespec/http";
import "../model/index.tsp";

using TypeSpec.Http;

@doc("全リクエストに共通するヘッダ")
model CommonHeaders {
  @doc("リクエストの相関ID。クライアントが UUID v7 で採番して必ず送る")
  @header("X-Request-Id")
  requestId: RequestId;
}
