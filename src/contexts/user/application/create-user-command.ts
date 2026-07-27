import { Effect, Option, Schema } from "effect";
import { MailAddress } from "~/shared/domain/mail-address";
import { Password } from "~/shared/domain/password";
import {
  MailAddressAlreadyExistsError,
  type RepositoryError,
} from "~/shared/error";
import { PasswordHasher } from "~/shared/service/password-hasher";
import type { UuidGenerator } from "~/shared/service/uuid-generator";
import { UserRepository } from "../domain/user-repository";
import * as User from "../domain/model";

/**
 * ユーザー新規作成コマンドの入力スキーマ。
 * 値オブジェクトのスキーマを組み合わせて構成しているため、
 * 呼び出し側は生の入力を一度 decode するだけで検証済みの値が得られる
 * (フィールドごとの詰め替えが不要になる)。
 */
export const CreateUserCommandInput = Schema.Struct({
  name: User.Name,
  mailAddress: MailAddress,
  password: Password,
});
export type CreateUserCommandInput = typeof CreateUserCommandInput.Type;

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
      .pipe(Effect.flatMap(Schema.decode(User.HashedPassword)), Effect.orDie);

    // 3. User 集約を生成
    const user = yield* User.create({
      name: input.name,
      mailAddress: input.mailAddress,
      hashedPassword,
    });

    // 4. リポジトリへ永続化
    yield* userRepository.create(user);
  });
