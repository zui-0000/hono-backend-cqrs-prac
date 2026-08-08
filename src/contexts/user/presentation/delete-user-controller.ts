import { Effect } from "effect";

import {
  deleteUserCommand,
  DeleteUserCommandInput,
} from "~/contexts/user/application/delete-user-command";
import type { DeleteUserParams } from "~/generated/users";
import { decodeInput } from "~/shared/presentation/request-validator";

type DeleteUserControllerInput = { params: typeof DeleteUserParams.Type };

/**
 * ユーザーを削除する (DELETE /users/{id})。
 *
 *
 * リクエストの契約検証と応答の組み立ては user-routes.ts が行う。
 * 契約上は要認証 (Bearer) だが、認証は auth コンテキストの実装後に追加する。
 */
export const deleteUserController = ({ params }: DeleteUserControllerInput) =>
  Effect.gen(function* () {
    const input = yield* decodeInput(DeleteUserCommandInput, {
      id: params.id,
    });

    yield* deleteUserCommand(input);
  });
