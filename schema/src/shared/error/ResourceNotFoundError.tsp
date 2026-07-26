import "../model/index.tsp";
import "./ErrorCode.tsp";
import "./ErrorMessage.tsp";

@summary("ResourceNotFoundError")
@doc("リソースが存在しない (汎用)")
@error
@example(#{
  errorCode: "4040",
  message: "ResourceNotFoundError",
  meta: #{ respondedAt: RespondedAt.fromISO("2025-01-01T12:00:00Z") },
})
model ResourceNotFoundError {
  errorCode: ErrorCode;
  message: ErrorMessage;
  meta: CommonResponseMeta;
}
