import "../model/index.tsp";
import "./ErrorCode.tsp";
import "./ErrorMessage.tsp";

@summary("ResourceNotFoundError")
@doc("リソースが存在しない (汎用)")
@error
@example(#{ errorCode: "4040", message: "ResourceNotFoundError" })
model ResourceNotFoundError {
  errorCode: ErrorCode;
  message: ErrorMessage;
}
