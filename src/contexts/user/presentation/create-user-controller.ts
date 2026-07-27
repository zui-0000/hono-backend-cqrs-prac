import { Effect } from "effect";
import { createUserCommand } from "~/contexts/user/application/create-user-command";
import { CreateUserCommandInput } from "~/contexts/user/application/dto";
import {
  CreateUser201Response,
  CreateUserBody,
  CreateUserHeader,
} from "~/generated/users";
import { handleWithEffect } from "~/shared/presentation/handle-with-effect";
import { metaOnlyBody } from "~/shared/presentation/response";
import { decodeInput, validateJson } from "~/shared/presentation/validator";

/**
 * ユーザーを新規作成する (POST /users)。
 */
export const createUserController = handleWithEffect(
  201,
  CreateUser201Response,
  CreateUserHeader,
  (c) =>
    Effect.gen(function* () {
      const body = yield* validateJson(c, CreateUserBody);
      const input = yield* decodeInput(CreateUserCommandInput, body);

      yield* createUserCommand(input);
      return yield* metaOnlyBody;
    }),
);
