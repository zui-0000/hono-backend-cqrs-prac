import { Effect } from "effect";

import { UpdateUserCommandInput } from "~/contexts/user/application/dto";
import { updateUserCommand } from "~/contexts/user/application/update-user-command";
import {
  UpdateUserBody,
  UpdateUserHeader,
  UpdateUserParams,
} from "~/generated/users";
import { handleNoContentWithEffect } from "~/shared/presentation/handle-with-effect";
import {
  decodeInput,
  validateJson,
  validateParams,
} from "~/shared/presentation/validator";

/**
 * ユーザーを更新する (PUT /users/{id})。
 *
 * 入力源がパスパラメータとボディの 2 つあるため、それぞれ API 契約で検証してから
 * 1 つのユースケース入力へ合成する (合成は presentation 層の責務)。
 * id はパス側を正とする (ボディに id は無いが、順序で意図を明示する)。
 *
 * 応答は 204 (本文なし) なので handleNoContentWithEffect を使う。
 *
 * 契約上は要認証 (Bearer) だが、認証は auth コンテキストの実装後に追加する。
 */
export const updateUserController = handleNoContentWithEffect(
  UpdateUserHeader,
  (c) =>
    Effect.gen(function* () {
      const params = yield* validateParams(c, UpdateUserParams);
      const body = yield* validateJson(c, UpdateUserBody);
      const input = yield* decodeInput(UpdateUserCommandInput, {
        ...body,
        id: params.id,
      });

      yield* updateUserCommand(input);
    }),
);
