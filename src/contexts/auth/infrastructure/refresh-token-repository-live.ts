import { and, eq, isNull } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";

import { RefreshToken } from "~/contexts/auth/domain/model/refresh-token";
import { RefreshTokenRepository } from "~/contexts/auth/domain/refresh-token-repository";
import { Database } from "~/shared/infrastructure/db/client";
import { handleDbFailure } from "~/shared/infrastructure/db/error/handle-db-failure";

import { tRefreshToken } from "./drizzle-schema";

/**
 * 検索結果の先頭行を RefreshToken 集約に復元する (0 件なら Option.none)。
 * 行の型がそのまま RefreshToken.Encoded なので、列ごとに組み立てず丸ごと decode する
 * (revoked_at の NULL は Option.none になる)。
 * DB の値は既に妥当な前提のため decode 失敗は defect 扱い。
 */
const toDomainHead = (
  rows: readonly (typeof tRefreshToken.$inferSelect)[],
): Effect.Effect<Option.Option<RefreshToken>> =>
  Option.fromNullable(rows[0]).pipe(
    Option.map((row) => Schema.decode(RefreshToken)(row).pipe(Effect.orDie)),
    Effect.transposeOption,
  );

/** 集約を行の形へ落とす。Encoded がそのまま insert の値になる。 */
const toRow = (token: RefreshToken): typeof tRefreshToken.$inferInsert =>
  Schema.encodeSync(RefreshToken)(token);

/**
 * RefreshTokenRepository の Drizzle 実装 (アダプタ)。
 * 接続は import で掴まず Database から受け取るため succeed ではなく effect を使う。
 */
export const RefreshTokenRepositoryLive = Layer.effect(
  RefreshTokenRepository,
  Effect.gen(function* () {
    const db = yield* Database;

    return {
      create: (token) =>
        Effect.tryPromise(() =>
          db.insert(tRefreshToken).values(toRow(token)),
        ).pipe(handleDbFailure, Effect.asVoid),

      findByTokenHash: (tokenHash) =>
        Effect.tryPromise(() =>
          db
            .select()
            .from(tRefreshToken)
            .where(eq(tRefreshToken.tokenHash, tokenHash))
            .limit(1),
        ).pipe(handleDbFailure, Effect.flatMap(toDomainHead)),

      // 失効と発行を 1 トランザクションで行う。間で落ちるとクライアントは
      // 手元の券が使えないまま新しい券も受け取れず、再ログインしか道が無くなる
      // (ポートで 2 つに分けなかった理由そのもの)。
      rotate: ({ revoked, issued }) =>
        Effect.tryPromise(() =>
          db.transaction(async (tx) => {
            await tx
              .update(tRefreshToken)
              .set({ revokedAt: Option.getOrNull(revoked.revokedAt) })
              .where(eq(tRefreshToken.id, revoked.id));
            await tx.insert(tRefreshToken).values(toRow(issued));
          }),
        ).pipe(handleDbFailure, Effect.asVoid),

      // 既に失効している行は触らない (is null で絞る)。上書きすると
      // 「いつ失効したか」がずれ、猶予期間の判定が狂う。
      revokeSession: ({ sessionId, revokedAt }) =>
        Effect.tryPromise(() =>
          db
            .update(tRefreshToken)
            .set({ revokedAt })
            .where(
              and(
                eq(tRefreshToken.sessionId, sessionId),
                isNull(tRefreshToken.revokedAt),
              ),
            ),
        ).pipe(handleDbFailure, Effect.asVoid),
    };
  }),
);
