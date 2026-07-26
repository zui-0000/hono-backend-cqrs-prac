import "../model/index.tsp";

@summary("InternalServerError")
@doc("サーバー内部で予期せぬエラーが発生した (汎用)")
@error
@example(#{
  errorCode: "5000",
  message: "InternalServerError",
  meta: #{ respondedAt: RespondedAt.fromISO("2025-01-01T12:00:00Z") },
})
model InternalServerError {
  errorCode: ErrorCode;
  message: ErrorMessage;
  meta: CommonResponseMeta;
}
