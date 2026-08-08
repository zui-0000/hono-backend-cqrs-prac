import { Effect } from "effect";

import { refreshCommand } from "~/contexts/auth/application/refresh-command";
import type { RefreshBody } from "~/generated/auth";
import { decodeInput } from "~/shared/presentation/request-validator";

import { RefreshCommandInput } from "../application/refresh-command";

/** 受け取る検証済みの入力。auth-routes.ts の request 宣言と対応する。 */
type RefreshControllerInput = { body: typeof RefreshBody.Type };

/**
 * アクセストークンを再発行する (POST /auth/refresh)。
 *
 * リクエストの契約検証 (ヘッダ / ボディ) と応答の組み立ては auth-routes.ts が行う。
 * 契約上は認証不要 — 提示された券そのものが認証の材料なので、
 * Bearer を持っていない (= アクセストークンが切れた) 状態で叩かれる。
 */
export const refreshController = ({ body }: RefreshControllerInput) =>
  Effect.gen(function* () {
    const input = yield* decodeInput(RefreshCommandInput, body);

    // 差し替えた券の組をそのまま返す (契約の RefreshResponse と同じ形)。
    return yield* refreshCommand(input);
  });
