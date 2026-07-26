import "../model/index.tsp";
import "./ErrorCode.tsp";
import "./ErrorMessage.tsp";

@summary("ConflictError")
@doc("リソースの現在の状態と衝突する (汎用)")
@error
@example(#{
  errorCode: "4090",
  message: "ConflictError",
  meta: #{ respondedAt: RespondedAt.fromISO("2025-01-01T12:00:00Z") },
})
model ConflictError {
  errorCode: ErrorCode;
  message: ErrorMessage;
  meta: CommonResponseMeta;
}
