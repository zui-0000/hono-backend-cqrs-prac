import { eq } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";
import * as User from "~/features/user/domain/model";
import { UserRepository } from "~/features/user/domain/user-repository";
import { db } from "~/shared/db/client";
import { isSqlStateViolation, SqlState } from "~/shared/db/error";
import { tUser } from "~/shared/db/schema";
import { MailAddress } from "~/shared/domain/mail-address";
import { MailAddressAlreadyExistsError, RepositoryError } from "~/shared/error";

/** DB 行 → User 集約への復元。DB の値は既に妥当な前提のため decode 失敗は defect 扱い。 */
const toDomain = (row: typeof tUser.$inferSelect): Effect.Effect<User.Model> =>
  Effect.gen(function* () {
    const id = yield* Schema.decode(User.Id)(row.id);
    const name = yield* Schema.decode(User.Name)(row.name);
    const mailAddress = yield* Schema.decode(MailAddress)(row.mailAddress);
    const hashedPassword = yield* Schema.decode(User.HashedPassword)(
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
  user: User.Model,
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
): Effect.Effect<Option.Option<User.Model>> =>
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

  update: (user) =>
    write(user, () =>
      db
        .update(tUser)
        .set({
          name: user.name,
          mailAddress: user.mailAddress,
          hashedPassword: user.hashedPassword,
          updatedAt: user.updatedAt,
        })
        .where(eq(tUser.id, user.id)),
    ),

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
