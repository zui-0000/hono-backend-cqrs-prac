import { Effect, Option } from "effect";

import { GetUserQueryService } from "~/contexts/user/application/get-user-query-service";
import {
  GetUser200Response,
  GetUserHeader,
  GetUserParams,
} from "~/generated/users";
import { ResourceNotFoundError } from "~/shared/error/resource-not-found-error";
import { handleWithEffect } from "~/shared/presentation/handle-with-effect";
import { successBody } from "~/shared/presentation/response";
import { validateParams } from "~/shared/presentation/validator";

/**
 * ID を指定してユーザーを取得する (GET /users/{id})。
 *
 * 契約上は要認証 (Bearer) だが、認証は auth コンテキストの実装後に追加する。
 */
export const getUserController = handleWithEffect(
  200,
  GetUser200Response,
  GetUserHeader,
  (c) =>
    Effect.gen(function* () {
      const params = yield* validateParams(c, GetUserParams);
      const getUserQueryService = yield* GetUserQueryService;

      // 存在しない id は「見つからない」として 404 に翻訳する。
      const user = yield* getUserQueryService.execute(params.id).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              new ResourceNotFoundError({
                message: "指定されたユーザーは存在しません",
              }),
            onSome: Effect.succeed,
          }),
        ),
      );

      // 契約が返すのは name / mailAddress のみ (DTO をそのまま流さない)。
      return yield* successBody({
        name: user.name,
        mailAddress: user.mailAddress,
      });
    }),
);
