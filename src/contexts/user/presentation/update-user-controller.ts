import { Effect } from "effect";

import {
  updateUserCommand,
  UpdateUserCommandInput,
} from "~/contexts/user/application/update-user-command";
import type { UpdateUserBody, UpdateUserParams } from "~/generated/users";
import { decodeInput } from "~/shared/presentation/request-validator";

type UpdateUserControllerInput = {
  body: typeof UpdateUserBody.Type;
  params: typeof UpdateUserParams.Type;
};

/**
 * ユーザーを更新する (PUT /users/{id})。
 *
 * リクエストの契約検証と応答の組み立ては user-routes.ts が行う。
 * 契約上は要認証 (Bearer) だが、認証は auth コンテキストの実装後に追加する。
 */
export const updateUserController = ({
  body,
  params,
}: UpdateUserControllerInput) =>
  Effect.gen(function* () {
    const input = yield* decodeInput(UpdateUserCommandInput, {
      ...body,
      id: params.id,
    });

    yield* updateUserCommand(input);
  });
