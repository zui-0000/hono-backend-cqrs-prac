import "@typespec/http";

using TypeSpec.Http;

/** 成功 */
model SuccessOkResponse<T> {
  @statusCode statusCode: 200;
  @body body: T;
}

/** 成功 */
model SuccessCreatedResponse<T> {
  @statusCode statusCode: 201;
  @body body: T;
}

/** 成功 */
model SuccessNoContentResponse {
  @statusCode statusCode: 204;
}
