import "@typespec/http";
import "@typespec/openapi";
import "@typespec/openapi3";
import "./users/index.tsp";
import "../shared/index.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@service(#{ title: "Backend API" })
namespace BackendApi {
  @tag("Users")
  @route("/users")
  namespace Users {
    /** ユーザーを新規作成する (サインアップ想定のため認証不要) */
    @post
    @operationId("createUser")
    op create(@body body: CreateUserRequest):
      | SuccessCreatedResponse<CreateUserResponse>
      | BadRequestErrorResponse
      | InternalServerErrorResponse;

    /** IDを指定してユーザーを取得する (要認証) */
    @get
    @route("/{id}")
    @operationId("getUser")
    op get(@path id: UserId):
      | SuccessOkResponse<GetUserResponse>
      | UnauthorizedErrorResponse
      | NotFoundErrorResponse
      | InternalServerErrorResponse;

    /** ユーザーを更新する (要認証) */
    @put
    @route("/{id}")
    @operationId("updateUser")
    op update(@path id: UserId, @body body: UpdateUserRequest):
      | SuccessNoContentResponse
      | BadRequestErrorResponse
      | UnauthorizedErrorResponse
      | NotFoundErrorResponse
      | InternalServerErrorResponse;

    /** ユーザーを削除する (要認証) */
    @delete
    @route("/{id}")
    @operationId("deleteUser")
    op delete(@path id: UserId):
      | SuccessNoContentResponse
      | UnauthorizedErrorResponse
      | NotFoundErrorResponse
      | InternalServerErrorResponse;
  }
}
