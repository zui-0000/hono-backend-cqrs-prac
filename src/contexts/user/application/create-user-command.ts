import { Effect, Option, Schema } from "effect";
import {
  MailAddressAlreadyExistsError,
  type RepositoryError,
} from "~/shared/error";
import { PasswordHasher } from "~/shared/service/password-hasher";
import type { UuidGenerator } from "~/shared/service/uuid-generator";
import { createUser } from "../domain/model/user";
import { UserHashedPassword } from "../domain/model/vo/user-hashed-password";
import { UserRepository } from "../domain/user-repository";
import type { CreateUserCommandInput } from "./dto";

/**
 * ユーザーを新規作成する (CQRS のコマンド)。
 *
 * 1. メールアドレスの重複を事前チェック (UX 用。最後の砦は DB の unique 制約)
 * 2. 平文パスワードをハッシュ化 (PasswordHasher。ドメインは平文を知らない)
 * 3. User 集約を生成 (id 採番・作成/更新日時は Clock/UuidGenerator 経由)
 * 4. リポジトリへ永続化
 *
 * 失敗 (E) と依存 (R) がすべて型に現れる = throw を使わない。
 * 状態を変えるだけで値は返さない (CQRS のコマンド)。API 契約上も
 * 作成したユーザーの情報は応答に含めないため、集約を外に出す必要がない。
 */
export const createUserCommand = (
  input: CreateUserCommandInput,
): Effect.Effect<
  void,
  MailAddressAlreadyExistsError | RepositoryError,
  UserRepository | PasswordHasher | UuidGenerator
> =>
  Effect.gen(function* () {
    const userRepository = yield* UserRepository;
    const passwordHasher = yield* PasswordHasher;

    // 1. メールアドレスの重複チェック
    yield* userRepository.findByMailAddress(input.mailAddress).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.void,
          onSome: () =>
            new MailAddressAlreadyExistsError({
              mailAddress: input.mailAddress,
            }),
        }),
      ),
    );

    // 2. パスワードをハッシュ化 (結果は必ず妥当なので decode 失敗は defect 扱い)
    const hashedPassword = yield* passwordHasher
      .hash(input.password)
      .pipe(Effect.flatMap(Schema.decode(UserHashedPassword)), Effect.orDie);

    // 3. User 集約を生成
    const user = yield* createUser({
      name: input.name,
      mailAddress: input.mailAddress,
      hashedPassword,
    });

    // 4. リポジトリへ永続化
    yield* userRepository.create(user);
  });
