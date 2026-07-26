import "../model/index.tsp";
import "./ErrorCode.tsp";
import "./ErrorMessage.tsp";

@summary("UnauthorizedError")
@doc("認証情報が不正 (汎用)")
@error
@example(#{
  errorCode: "4010",
  message: "UnauthorizedError",
  meta: #{ respondedAt: RespondedAt.fromISO("2025-01-01T12:00:00Z") },
})
model UnauthorizedError {
  errorCode: ErrorCode;
  message: ErrorMessage;
  meta: CommonResponseMeta;
}
