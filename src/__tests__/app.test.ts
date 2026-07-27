import { describe, expect, test } from "bun:test";
import { Effect, Layer, ManagedRuntime, Option, Schema } from "effect";
import { createApp } from "~/app";
import * as User from "~/contexts/user/domain/model";
import { UserRepository } from "~/contexts/user/domain/user-repository";
import { MailAddress } from "~/shared/domain/mail-address";
import { PasswordHasher } from "~/shared/service/password-hasher";
import { UuidGenerator } from "~/shared/service/uuid-generator";

/**
 * HTTP 境界の統合テスト (DB・実サービスなし)。
 *
 * createApp はランタイムを引数で受け取るため、本番の Layer の代わりに
 * テスト用の Layer から作ったランタイムを渡せる。これにより
 * 「リクエスト → 検証 → コマンド → リポジトリ呼び出し → 応答」までを
 * DB を起動せず、かつ決定的 (採番が固定) に検証できる。
 */

const FIXED_UUID = "019fa5bc-0000-7000-8000-000000000000";

const REQUEST_ID = "019fa5bc-1111-7000-8000-000000000000";

const validBody = {
  name: "アスカ",
  mailAddress: "asuka@example.com",
  password: "SuperSecret123!",
};

/** テスト用ランタイム。UserRepository だけケースごとに部分差し替えする。 */
const makeRuntime = (
  userRepository: Partial<UserRepository["Type"]> = {},
): ManagedRuntime.ManagedRuntime<
  UserRepository | PasswordHasher | UuidGenerator,
  never
> =>
  ManagedRuntime.make(
    Layer.mergeAll(
      Layer.succeed(UserRepository, {
        create: () => Effect.void,
        update: () => Effect.void,
        findById: () => Effect.succeed(Option.none()),
        findByMailAddress: () => Effect.succeed(Option.none()),
        deleteById: () => Effect.void,
        ...userRepository,
      }),
      Layer.succeed(PasswordHasher, {
        hash: () => Effect.succeed("hashed-by-fake"),
        verify: () => Effect.succeed(true),
      }),
      // 採番を固定し、生成される id を予測可能にする。
      Layer.succeed(UuidGenerator, { next: Effect.succeed(FIXED_UUID) }),
    ),
  );

const postUsers = async (
  runtime: ReturnType<typeof makeRuntime>,
  body: Record<string, unknown>,
): Promise<Response> =>
  await createApp(runtime).request("/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": REQUEST_ID,
    },
    body: JSON.stringify(body),
  });

describe("POST /users", () => {
  test("正常系: 201 を返し、ハッシュ済みの User を永続化する", async () => {
    const created: User.Model[] = [];
    const runtime = makeRuntime({
      create: (user) =>
        Effect.sync(() => {
          created.push(user);
        }),
    });

    const response = await postUsers(runtime, validBody);

    expect(response.status).toBe(201);
    expect(response.headers.get("X-Request-Id")).toBe(REQUEST_ID);
    expect(created).toHaveLength(1);
    // 採番は UuidGenerator 経由なので、テストでは固定値になる。
    expect(created[0]?.id).toBe(FIXED_UUID as User.Id);
    // ドメインは平文を持たず、PasswordHasher の結果だけを保持する。
    expect(created[0]?.hashedPassword).toBe(
      "hashed-by-fake" as User.HashedPassword,
    );
  });

  test("異常系: メールアドレス重複は 409 (errorCode 4091)", async () => {
    const existing: User.Model = {
      id: Schema.decodeSync(User.Id)(FIXED_UUID),
      name: Schema.decodeSync(User.Name)("既存ユーザー"),
      mailAddress: Schema.decodeSync(MailAddress)(validBody.mailAddress),
      hashedPassword: Schema.decodeSync(User.HashedPassword)("hashed"),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const runtime = makeRuntime({
      findByMailAddress: () => Effect.succeed(Option.some(existing)),
    });

    const response = await postUsers(runtime, validBody);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ errorCode: "4091" });
  });

  test("異常系: 契約に反するリクエストは 400 と該当フィールド", async () => {
    const response = await postUsers(makeRuntime(), {
      ...validBody,
      password: "short",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: "4000",
      details: [{ field: "password" }],
    });
  });
});
