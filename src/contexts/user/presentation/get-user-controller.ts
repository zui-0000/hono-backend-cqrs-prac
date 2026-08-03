import { Effect } from "effect";

import { GetUserQueryService } from "~/contexts/user/application/get-user-query-service";
import type { GetUserParams } from "~/generated/users";
import { orNotFound } from "~/shared/application/or-not-found";

/** 受け取る検証済みの入力。user-routes.ts の request 宣言と対応する。 */
type GetUserControllerInput = { params: typeof GetUserParams.Type };

/**
 * ID を指定してユーザーを取得する (GET /users/{id})。
 *
 * リクエストの契約検証 (ヘッダ / パスパラメータ) と応答の組み立ては
 * user-routes.ts が行う。
 * 契約上は要認証 (Bearer) だが、認証は auth コンテキストの実装後に追加する。
 */
export const getUserController = ({ params }: GetUserControllerInput) =>
  Effect.gen(function* () {
    const getUserQueryService = yield* GetUserQueryService;

    // 存在しない id は「見つからない」として 404 に翻訳する。
    const user = yield* getUserQueryService.execute(params.id).pipe(orNotFound);

    // 契約が返すのは name / mailAddress のみ (DTO をそのまま流さない)。
    return { name: user.name, mailAddress: user.mailAddress };
  });
