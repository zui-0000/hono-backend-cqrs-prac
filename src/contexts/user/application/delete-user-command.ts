import { Effect, Option } from "effect";

import type { RepositoryError } from "~/shared/error/repository-error";
import { ResourceNotFoundError } from "~/shared/error/resource-not-found-error";

import { UserRepository } from "../domain/user-repository";
import type { DeleteUserCommandInput } from "./dto";

/**
 * ユーザーを削除する (CQRS のコマンド)。
 *
 * 1. 対象の存在確認 (存在しなければ 404)
 * 2. リポジトリから削除
 *
 * 削除前に存在確認するのは、API 契約が 404 を返すと定めているから。
 * ポートの deleteById は「その ID の行が無い状態」だけを保証し、
 * 何件消したかは返さない (影響行数は DB 都合の概念なので、
 * ドメインのポートには持ち込まない)。そのため存在判定は別クエリで行う。
 *
 * 集約を復元しても遷移させないため、User を受け取らず存在確認だけに使う。
 * 削除はドメインの不変条件を持たない操作なので、ドメインに関数を足す必要もない。
 */
export const deleteUserCommand = (
  input: DeleteUserCommandInput,
): Effect.Effect<
  void,
  ResourceNotFoundError | RepositoryError,
  UserRepository
> =>
  Effect.gen(function* () {
    const userRepository = yield* UserRepository;

    // 1. 存在確認
    yield* userRepository.findById(input.id).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () =>
            new ResourceNotFoundError({
              message: "指定されたユーザーは存在しません",
            }),
          onSome: () => Effect.void,
        }),
      ),
    );

    // 2. 削除
    yield* userRepository.deleteById(input.id);
  });
