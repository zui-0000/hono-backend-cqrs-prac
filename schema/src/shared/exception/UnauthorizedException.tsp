import "../model/index.tsp";
import "./ErrorCode.tsp";
import "./ErrorMessage.tsp";

@summary("UnauthorizedException")
@doc("認証情報が不正")
@error
@example(#{
  errorCode: "4010",
  message: "UnauthorizedException",
  meta: #{ respondedAt: RespondedAt.fromISO("2025-01-01T12:00:00Z") },
})
model UnauthorizedException {
  errorCode: ErrorCode;
  message: ErrorMessage;
  meta: CommonResponseMeta;
}
