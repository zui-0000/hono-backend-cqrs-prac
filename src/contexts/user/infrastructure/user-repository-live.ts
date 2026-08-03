import { eq } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";

import { User } from "~/contexts/user/domain/model/user";
import { UserHashedPassword } from "~/contexts/user/domain/model/value-objects/user-hashed-password";
import { UserId } from "~/contexts/user/domain/model/value-objects/user-id";
import { UserName } from "~/contexts/user/domain/model/value-objects/user-name";
import { UserRepository } from "~/contexts/user/domain/user-repository";
import { db } from "~/shared/db/client";
import { isSqlStateViolation, SqlState } from "~/shared/db/error";
import { MailAddress } from "~/shared/domain/value-objects/mail-address";
import { MailAddressAlreadyExistsError } from "~/shared/errors/mail-address-already-exists-error";
import { RepositoryError } from "~/shared/errors/repository-error";

import { tUser } from "./drizzle-schema";

/** DB 行 → User 集約への復元。DB の値は既に妥当な前提のため decode 失敗は defect 扱い。 */
const toDomain = (row: typeof tUser.$inferSelect): Effect.Effect<User> =>
  Effect.gen(function* () {
    const id = yield* Schema.decode(UserId)(row.id);
    const name = yield* Schema.decode(UserName)(row.name);
    const mailAddress = yield* Schema.decode(MailAddress)(row.mailAddress);
    const hashedPassword = yield* Schema.decode(UserHashedPassword)(
      row.hashedPassword,
    );
    return {
      id,
      name,
      mailAddress,
      hashedPassword,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }).pipe(Effect.orDie);

/** DB 操作を Effect に包み、例外を RepositoryError (型付きエラー) に翻訳する。 */
const query = <A>(
  operation: () => Promise<A>,
): Effect.Effect<A, RepositoryError> =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) => new RepositoryError({ cause }),
  });

// t_user のメールアドレス一意制約 (migration が生成した制約名)。
const MAIL_ADDRESS_UNIQUE_CONSTRAINT = "t_user_mail_address_unique";

/**
 * 書き込み操作を Effect に包み、メールアドレスの一意制約違反を
 * MailAddressAlreadyExistsError (409) に翻訳する。
 *
 * アプリ側の事前チェックをすり抜けた同時実行 (TOCTOU) を DB の制約が捕まえる
 * 「最後の砦」の経路。それ以外の失敗は RepositoryError (500) のまま。
 */
const write = (
  user: User,
  operation: () => Promise<unknown>,
): Effect.Effect<void, MailAddressAlreadyExistsError | RepositoryError> =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) =>
      isSqlStateViolation(
        cause,
        SqlState.UniqueViolation,
        MAIL_ADDRESS_UNIQUE_CONSTRAINT,
      )
        ? new MailAddressAlreadyExistsError({ mailAddress: user.mailAddress })
        : new RepositoryError({ cause }),
  }).pipe(Effect.asVoid);

/**
 * 検索結果の先頭行を User 集約に復元する (0 件なら Option.none)。
 * 単一取得系 (findById / findByMailAddress) で共有する。
 */
const toDomainHead = (
  rows: readonly (typeof tUser.$inferSelect)[],
): Effect.Effect<Option.Option<User>> =>
  Option.fromNullable(rows[0]).pipe(
    Option.map(toDomain),
    Effect.transposeOption,
  );

/**
 * UserRepository の Drizzle 実装 (アダプタ)。
 * ポート (domain/user-repository.ts) に対する具体実装で、Layer として注入する。
 */
export const UserRepositoryLive = Layer.succeed(UserRepository, {
  create: (user) =>
    write(user, () =>
      db.insert(tUser).values({
        id: user.id,
        name: user.name,
        mailAddress: user.mailAddress,
        hashedPassword: user.hashedPassword,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }),
    ),

  // set に並べるのは「その遷移が変える項目」だけ。触らない列を書き戻さないことが
  // 分けた理由そのものなので、ここに項目を足すときはポートの doc を読むこと。
  updateProfile: (user) =>
    write(user, () =>
      db
        .update(tUser)
        .set({
          name: user.name,
          mailAddress: user.mailAddress,
          updatedAt: user.updatedAt,
        })
        .where(eq(tUser.id, user.id)),
    ),

  // メールアドレスを書かないので一意制約違反は起こりえない。
  // よって write (409 への翻訳) ではなく query を使う。
  updatePassword: (user) =>
    query(() =>
      db
        .update(tUser)
        .set({
          hashedPassword: user.hashedPassword,
          updatedAt: user.updatedAt,
        })
        .where(eq(tUser.id, user.id)),
    ).pipe(Effect.asVoid),

  findById: (id) =>
    query(() => db.select().from(tUser).where(eq(tUser.id, id)).limit(1)).pipe(
      Effect.flatMap(toDomainHead),
    ),

  findByMailAddress: (mailAddress) =>
    query(() =>
      db
        .select()
        .from(tUser)
        .where(eq(tUser.mailAddress, mailAddress))
        .limit(1),
    ).pipe(Effect.flatMap(toDomainHead)),

  deleteById: (id) =>
    query(() => db.delete(tUser).where(eq(tUser.id, id))).pipe(Effect.asVoid),
});
