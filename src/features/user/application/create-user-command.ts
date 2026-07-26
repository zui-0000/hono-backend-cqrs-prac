import { Effect, Option, Schema } from "effect";
import { MailAddress } from "~/shared/domain/mail-address";
import { Password } from "~/shared/domain/password";
import {
  MailAddressAlreadyExistsError,
  type RepositoryError,
} from "~/shared/error";
import { PasswordHasher } from "~/shared/service/password-hasher";
import type { UuidGenerator } from "~/shared/service/uuid-generator";
import * as User from "../domain";

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
  User.Repository | PasswordHasher | UuidGenerator
> =>
  Effect.gen(function* () {
    const userRepository = yield* User.Repository;
    const passwordHasher = yield* PasswordHasher;

    // メアド重複チェック
    const existing = yield* userRepository.findByMailAddress(input.mailAddress);
    if (Option.isSome(existing)) {
      return yield* new MailAddressAlreadyExistsError({
        mailAddress: input.mailAddress,
      });
    }

    // パスワードハッシュ化
    // ハッシュ化の結果は必ず妥当な HashedPassword なので decode 失敗は defect 扱い。
    const rawHash = yield* passwordHasher.hash(input.password);
    const hashedPassword = yield* Schema.decode(User.HashedPassword)(
      rawHash,
    ).pipe(Effect.orDie);

    const user = yield* User.create({
      name: input.name,
      mailAddress: input.mailAddress,
      hashedPassword,
    });

    yield* userRepository.create(user);
  });
