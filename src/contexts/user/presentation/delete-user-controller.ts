import { Effect } from "effect";
import { deleteUserCommand } from "~/contexts/user/application/delete-user-command";
import { DeleteUserCommandInput } from "~/contexts/user/application/dto";
import { DeleteUserHeader, DeleteUserParams } from "~/generated/users";
import { handleNoContentWithEffect } from "~/shared/presentation/handle-with-effect";
import { decodeInput, validateParams } from "~/shared/presentation/validator";

/**
 * ユーザーを削除する (DELETE /users/{id})。
 *
 * 入力はパスパラメータのみ。契約の UserId (brand) をドメインの UserId へ
 * 変換するため、他のコマンドと同じく decodeInput を通す。
 *
 * 応答は 204 (本文なし) なので handleNoContentWithEffect を使う。
 *
 * 契約上は要認証 (Bearer) だが、認証は auth コンテキストの実装後に追加する。
 */
export const deleteUserController = handleNoContentWithEffect(
  DeleteUserHeader,
  (c) =>
    Effect.gen(function* () {
      const params = yield* validateParams(c, DeleteUserParams);
      const input = yield* decodeInput(DeleteUserCommandInput, {
        id: params.id,
      });

      yield* deleteUserCommand(input);
    }),
);
