import { Effect, Option, Schema } from "effect";
import type { MailAddress } from "~/shared/domain/mail-address";
import {
  MailAddressAlreadyExistsError,
  type RepositoryError,
} from "~/shared/error";
import { PasswordHasher } from "~/shared/service/password-hasher";
import type { UuidGenerator } from "~/shared/service/uuid-generator";
import * as User from "../domain";

/**
 * ユーザー新規作成コマンドの入力。
 * 検証済みの値オブジェクトのみを受け取る (生値の decode は presentation 層の責務)。
 * このため本コマンドの失敗は「ビジネス上の失敗」だけになる。
 */
export type CreateUserInput = {
  readonly name: User.Name;
  readonly mailAddress: MailAddress;
  readonly password: User.Password;
};

/**
 * ユーザーを新規作成する (CQRS のコマンド)。
 *
 * 1. メールアドレスの重複を事前チェック (UX 用。最後の砦は DB の unique 制約)
 * 2. 平文パスワードをハッシュ化 (PasswordHasher。ドメインは平文を知らない)
 * 3. User 集約を生成 (id 採番・作成/更新日時は Clock/UuidGenerator 経由)
 * 4. リポジトリへ永続化
 *
 * 失敗 (E) と依存 (R) がすべて型に現れる = throw を使わない。
 */
export const createUser = (
  input: CreateUserInput,
): Effect.Effect<
  User.User,
  MailAddressAlreadyExistsError | RepositoryError,
  User.Repository | PasswordHasher | UuidGenerator
> =>
  Effect.gen(function* () {
    const repository = yield* User.Repository;
    const passwordHasher = yield* PasswordHasher;

    const existing = yield* repository.findByMailAddress(input.mailAddress);
    if (Option.isSome(existing)) {
      return yield* new MailAddressAlreadyExistsError({
        mailAddress: input.mailAddress,
      });
    }

    const rawHash = yield* passwordHasher.hash(input.password);
    // ハッシュ化の結果は必ず妥当な HashedPassword なので decode 失敗は defect 扱い。
    const hashedPassword = yield* Schema.decode(User.HashedPassword)(
      rawHash,
    ).pipe(Effect.orDie);

    const user = yield* User.create({
      name: input.name,
      mailAddress: input.mailAddress,
      hashedPassword,
    });

    yield* repository.create(user);
    return user;
  });
