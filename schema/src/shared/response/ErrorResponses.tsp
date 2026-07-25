import "@typespec/http";
import "../exception/index.tsp";

using TypeSpec.Http;

/** リクエスト内容が不正 */
model BadRequestErrorResponse {
  @statusCode statusCode: 400;
  @body error: BadRequestException;
}

/** 認証情報が不正 */
model UnauthorizedErrorResponse {
  @statusCode statusCode: 401;
  @body error: UnauthorizedException;
}

/** リソースが見つからない */
model NotFoundErrorResponse {
  @statusCode statusCode: 404;
  @body error: ResourceNotFoundException;
}

/** サーバーエラー */
model InternalServerErrorResponse {
  @statusCode statusCode: 500;
}
