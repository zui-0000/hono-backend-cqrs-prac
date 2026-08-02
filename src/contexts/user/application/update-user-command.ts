import { Effect, Option } from "effect";

import type { MailAddressAlreadyExistsError } from "~/shared/error/mail-address-already-exists-error";
import type { RepositoryError } from "~/shared/error/repository-error";
import { ResourceNotFoundError } from "~/shared/error/resource-not-found-error";

import { changeUserProfile } from "../domain/model/user";
import { checkMailAddressDuplication } from "../domain/service/check-mail-address-duplication";
import { UserRepository } from "../domain/user-repository";
import type { UpdateUserCommandInput } from "./dto";

/**
 * ユーザーのプロフィールを更新する (CQRS のコマンド)。
 *
 * 1. 対象の User 集約を復元 (存在しなければ 404)
 * 2. メールアドレスの重複を事前チェック (UX 用。最後の砦は DB の unique 制約)
 * 3. 集約の状態遷移 (User.changeProfile。updatedAt はドメイン側で進む)
 * 4. リポジトリへ永続化
 *
 * 作成 (createUserCommand) との違いは 1 の「復元」があること。
 * 更新は既存の状態を前提とする操作なので、集約を読み出してから遷移させる。
 * ここで復元を挟むから「存在しない ID への更新」を 404 として表現できる。
 */
export const updateUserCommand = (
  input: UpdateUserCommandInput,
): Effect.Effect<
  void,
  ResourceNotFoundError | MailAddressAlreadyExistsError | RepositoryError,
  UserRepository
> =>
  Effect.gen(function* () {
    const userRepository = yield* UserRepository;

    // 1. 対象の集約を復元 (存在しなければ 404)
    const user = yield* userRepository.findById(input.id).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => new ResourceNotFoundError(),
          onSome: Effect.succeed,
        }),
      ),
    );

    // 2. メールアドレスの重複チェック。
    //    自分自身を除外しないと「メールアドレスを変えない更新」が 409 になる。
    yield* checkMailAddressDuplication(input.mailAddress, {
      excluding: user.id,
    });

    // 3. 集約の状態遷移 (元の user は書き換わらない)
    const updated = yield* changeUserProfile(user, {
      name: input.name,
      mailAddress: input.mailAddress,
    });

    // 4. リポジトリへ永続化
    yield* userRepository.update(updated);
  });
