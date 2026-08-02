import { Effect } from "effect";

import { UpdateUserCommandInput } from "~/contexts/user/application/dto";
import { updateUserCommand } from "~/contexts/user/application/update-user-command";
import type { UpdateUserBody, UpdateUserParams } from "~/generated/users";
import { decodeInput } from "~/shared/presentation/request-validator";

/** 受け取る検証済みの入力。user-routes.ts の request 宣言と対応する。 */
type UpdateUserControllerInput = {
  body: typeof UpdateUserBody.Type;
  params: typeof UpdateUserParams.Type;
};

/**
 * ユーザーを更新する (PUT /users/{id})。
 *
 * 入力源がパスパラメータとボディの 2 つあるため、検証済みの値を 1 つの
 * ユースケース入力へ合成する (合成は presentation 層の責務)。
 * id はパス側を正とする (ボディに id は無いが、順序で意図を明示する)。
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
