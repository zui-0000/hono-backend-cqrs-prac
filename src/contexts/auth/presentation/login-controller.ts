import { Effect } from "effect";

import type { LoginBody } from "~/generated/auth";
import { decodeInput } from "~/shared/presentation/request-validator";

import { LoginCommandInput, loginCommand } from "../application/login-command";

type LoginControllerInput = { body: typeof LoginBody.Type };

/**
 * メールアドレスとパスワードで券を発行する (POST /auth/login)。
 *
 * リクエストの契約検証 (ヘッダ / ボディ) と応答の組み立ては auth-routes.ts が行う。
 * 契約上は認証不要 — これが認証そのものの入口なので当然。
 */
export const loginController = ({ body }: LoginControllerInput) =>
  Effect.gen(function* () {
    const input = yield* decodeInput(LoginCommandInput, body);

    // 発行した券の組をそのまま返す (契約の LoginResponse と同じ形)。
    return yield* loginCommand(input);
  });
