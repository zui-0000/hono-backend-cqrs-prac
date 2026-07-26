import "../model/index.tsp";
import "./ErrorCode.tsp";
import "./ErrorMessage.tsp";

@summary("MailAddressAlreadyExistsError")
@doc("メールアドレスが既に使用されている")
@error
@example(#{
  errorCode: "4091",
  message: "MailAddressAlreadyExistsError",
  meta: #{ respondedAt: RespondedAt.fromISO("2025-01-01T12:00:00Z") },
})
model MailAddressAlreadyExistsError {
  errorCode: ErrorCode;
  message: ErrorMessage;
  meta: CommonResponseMeta;
}
