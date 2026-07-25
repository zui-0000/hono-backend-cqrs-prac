import "../model/index.tsp";
import "./ErrorCode.tsp";
import "./ErrorMessage.tsp";

@summary("ResourceNotFoundException")
@doc("リソースが存在しない")
@error
@example(#{
  errorCode: "4040",
  message: "ResourceNotFoundException",
  meta: #{ respondedAt: RespondedAt.fromISO("2025-01-01T12:00:00Z") },
})
model ResourceNotFoundException {
  errorCode: ErrorCode;
  message: ErrorMessage;
  meta: CommonResponseMeta;
}
