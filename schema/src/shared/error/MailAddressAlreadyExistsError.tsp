import "../model/index.tsp";
import "./ErrorCode.tsp";
import "./ErrorMessage.tsp";

@summary("MailAddressAlreadyExistsError")
@doc("メールアドレスが既に使用されている")
@error
@example(#{ errorCode: "4091", message: "MailAddressAlreadyExistsError" })
model MailAddressAlreadyExistsError {
  errorCode: ErrorCode;
  message: ErrorMessage;
}
