import { Effect } from "effect";

import {
  changePasswordCommand,
  ChangePasswordCommandInput,
} from "~/contexts/user/application/change-password-command";
import type {
  ChangePasswordBody,
  ChangePasswordParams,
} from "~/generated/users";
import { decodeInput } from "~/shared/presentation/request-validator";

type ChangePasswordControllerInput = {
  body: typeof ChangePasswordBody.Type;
  params: typeof ChangePasswordParams.Type;
};

/**
 * パスワードを変更する (PUT /users/{id}/password)。
 *
 * リクエストの契約検証と応答の組み立ては user-routes.ts が行う。
 * 契約上は要認証 (Bearer) だが、認証は auth コンテキストの実装後に追加する。
 */
export const changePasswordController = ({
  body,
  params,
}: ChangePasswordControllerInput) =>
  Effect.gen(function* () {
    const input = yield* decodeInput(ChangePasswordCommandInput, {
      ...body,
      id: params.id,
    });

    yield* changePasswordCommand(input);
  });
