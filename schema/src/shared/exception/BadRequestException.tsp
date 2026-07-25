import "../model/index.tsp";
import "./ErrorDetail.tsp";
import "./ErrorCode.tsp";
import "./ErrorMessage.tsp";

@summary("BadRequestException")
@doc("リクエスト内容が不正")
@error
@example(#{
  errorCode: "4000",
  message: "BadRequestException",
  meta: #{ respondedAt: RespondedAt.fromISO("2025-01-01T12:00:00Z") },
  details: #[#{ field: "email", message: "メールアドレスの形式が不正です" }],
})
model BadRequestException {
  errorCode: ErrorCode;
  message: ErrorMessage;
  meta: CommonResponseMeta;
  details?: ErrorDetail[];
}
