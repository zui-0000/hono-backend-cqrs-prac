import "../model/index.tsp";

@summary("InternalServerErrorException")
@doc("サーバー内部で予期せぬエラーが発生した")
@error
@example(#{
  errorCode: "5000",
  message: "InternalServerErrorException",
  meta: #{ respondedAt: RespondedAt.fromISO("2025-01-01T12:00:00Z") },
})
model InternalServerErrorException {
  errorCode: ErrorCode;
  message: ErrorMessage;
  meta: CommonResponseMeta;
}
