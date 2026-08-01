import { eq } from "drizzle-orm";
import { Effect, Layer, Option } from "effect";
import { GetUserQueryService } from "~/contexts/user/application/get-user-query-service";
import { db } from "~/shared/db/client";
import { tUser } from "~/shared/db/schema";
import { RepositoryError } from "~/shared/error/repository-error";

/**
 * GetUserQueryService の Drizzle 実装 (アダプタ)。
 *
 * SELECT の射影をそのまま DTO の形にしているため、集約への復元も decode も挟まない
 * (ドメインを一切 import しないのが Query 側の実装の特徴)。
 * 必要な列だけを取るので、集約の全列を読む Repository より素直かつ軽い。
 */
export const GetUserQueryServiceLive = Layer.succeed(GetUserQueryService, {
  execute: (id) =>
    Effect.tryPromise({
      try: () =>
        db
          .select({ name: tUser.name, mailAddress: tUser.mailAddress })
          .from(tUser)
          .where(eq(tUser.id, id))
          .limit(1),
      catch: (cause) => new RepositoryError({ cause }),
    }).pipe(Effect.map((rows) => Option.fromNullable(rows[0]))),
});
