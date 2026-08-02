import { Effect } from "effect";

import { deleteUserCommand } from "~/contexts/user/application/delete-user-command";
import { DeleteUserCommandInput } from "~/contexts/user/application/dto";
import type { DeleteUserParams } from "~/generated/users";
import { decodeInput } from "~/shared/presentation/request-validator";

/** 受け取る検証済みの入力。user-routes.ts の request 宣言と対応する。 */
type DeleteUserControllerInput = { params: typeof DeleteUserParams.Type };

/**
 * ユーザーを削除する (DELETE /users/{id})。
 *
 * 入力はパスパラメータのみ。契約の UserId (brand) をドメインの UserId へ
 * 変換するため、他のコマンドと同じく decodeInput を通す。
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
