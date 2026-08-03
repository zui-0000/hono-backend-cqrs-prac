import { Effect, Option } from "effect";

import { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

/**
 * 「見つからなければ 404」というユースケースの方針に名前を与える。
 *
 * これは業務ルールではない (ビジネス側に「存在しない ID を指定されたら
 * どうしますか？」は聞けない) ため domain には置かず、application 層に置く。
 *
 * 引数をリポジトリではなく Option を返す Effect にしてあるのが要点。
 * 「User を id で引いて無ければ 404」に閉じた形 (findUserOrFail) にすると
 * コマンド経路 (UserRepository) しか吸収できないが、Option → 404 の変換だけを
 * 切り出せば読み取り経路 (QueryService) も同じ形で書ける。
 * 結果として user コンテキスト固有の関数ではなくなるので shared/ に置いている。
 */
export const orNotFound = <A, E, R>(
  effect: Effect.Effect<Option.Option<A>, E, R>,
): Effect.Effect<A, E | ResourceNotFoundError, R> =>
  Effect.flatMap(
    effect,
    Option.match({
      onNone: () => new ResourceNotFoundError(),
      onSome: Effect.succeed<A>,
    }),
  );
