import { Effect } from "effect";

import { createUserCommand } from "~/contexts/user/application/create-user-command";
import { CreateUserCommandInput } from "~/contexts/user/application/dto";
import type { CreateUserBody } from "~/generated/users";
import { decodeInput } from "~/shared/presentation/request-validator";

/** 受け取る検証済みの入力。user-routes.ts の request 宣言と対応する。 */
type CreateUserControllerInput = { body: typeof CreateUserBody.Type };

/**
 * ユーザーを新規作成する (POST /users)。
 *
 * リクエストの契約検証 (ヘッダ / ボディ) と応答の組み立ては user-routes.ts が行う。
 * ここに残るのは「検証済みの入力を値オブジェクトへ変換し、ユースケースを呼ぶ」だけ。
 */
export const createUserController = ({ body }: CreateUserControllerInput) =>
  Effect.gen(function* () {
    const input = yield* decodeInput(CreateUserCommandInput, body);

    // 採番された id を返す (クライアントが GET /users/{id} を呼べるように)。
    const id = yield* createUserCommand(input);
    return { id };
  });
