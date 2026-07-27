import { describe, expect, test } from "bun:test";
import { Effect, Layer, ManagedRuntime, Option, Schema } from "effect";
import { createApp } from "~/app";
import type { UserDto } from "~/contexts/user/application/dto";
import { GetUserQueryService } from "~/contexts/user/application/get-user-query-service";
import * as User from "~/contexts/user/domain/model";
import { UserRepository } from "~/contexts/user/domain/user-repository";
import type { AppRuntime } from "~/runtime";
import { MailAddress } from "~/shared/domain/mail-address";
import { PasswordHasher } from "~/shared/service/password-hasher";
import { UuidGenerator } from "~/shared/service/uuid-generator";

/**
 * HTTP 境界の統合テスト (DB・実サービスなし)。
 *
 * createApp はランタイムを引数で受け取るため、本番の Layer の代わりに
 * テスト用の Layer から作ったランタイムを渡せる。これにより
 * 「リクエスト → 検証 → ユースケース → 応答」までを
 * DB を起動せず、かつ決定的 (採番が固定) に検証できる。
 */

const FIXED_UUID = "019fa5bc-0000-7000-8000-000000000000";

const REQUEST_ID = "019fa5bc-1111-7000-8000-000000000000";

const validBody = {
  name: "アスカ",
  mailAddress: "asuka@example.com",
  password: "SuperSecret123!",
};

/** テスト用ランタイム。検証したいサービスだけケースごとに部分差し替えする。 */
const makeRuntime = (
  overrides: {
    readonly userRepository?: Partial<UserRepository["Type"]>;
    readonly getUserQueryService?: Partial<GetUserQueryService>;
  } = {},
): AppRuntime =>
  ManagedRuntime.make(
    Layer.mergeAll(
      Layer.succeed(UserRepository, {
        create: () => Effect.void,
        update: () => Effect.void,
        findById: () => Effect.succeed(Option.none()),
        findByMailAddress: () => Effect.succeed(Option.none()),
        deleteById: () => Effect.void,
        ...overrides.userRepository,
      }),
      Layer.succeed(GetUserQueryService, {
        execute: () => Effect.succeed(Option.none()),
        ...overrides.getUserQueryService,
      }),
      Layer.succeed(PasswordHasher, {
        hash: () => Effect.succeed("hashed-by-fake"),
        verify: () => Effect.succeed(true),
      }),
      // 採番を固定し、生成される id を予測可能にする。
      Layer.succeed(UuidGenerator, { next: Effect.succeed(FIXED_UUID) }),
    ),
  );

const headers = {
  "Content-Type": "application/json",
  "X-Request-Id": REQUEST_ID,
};

const postUsers = async (
  runtime: AppRuntime,
  body: Record<string, unknown>,
): Promise<Response> =>
  await createApp(runtime).request("/users", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

const getUser = async (runtime: AppRuntime, id: string): Promise<Response> =>
  await createApp(runtime).request(`/users/${id}`, { headers });

describe("POST /users", () => {
  test("正常系: 201 を返し、ハッシュ済みの User を永続化する", async () => {
    const created: User.Model[] = [];
    const runtime = makeRuntime({
      userRepository: {
        create: (user) =>
          Effect.sync(() => {
            created.push(user);
          }),
      },
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
      userRepository: {
        findByMailAddress: () => Effect.succeed(Option.some(existing)),
      },
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

describe("GET /users/:id", () => {
  test("正常系: 200 を返し、契約どおり name / mailAddress のみを含む", async () => {
    const dto: UserDto = { name: "アスカ", mailAddress: "asuka@example.com" };
    const runtime = makeRuntime({
      getUserQueryService: { execute: () => Effect.succeed(Option.some(dto)) },
    });

    const response = await getUser(runtime, FIXED_UUID);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      result: { name: dto.name, mailAddress: dto.mailAddress },
    });
  });

  test("異常系: 存在しない id は 404 (errorCode 4040)", async () => {
    // 既定の fake は Option.none を返す = 見つからない。
    const response = await getUser(makeRuntime(), FIXED_UUID);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ errorCode: "4040" });
  });

  test("異常系: uuid v7 形式でない id は 400 と該当フィールド", async () => {
    const response = await getUser(makeRuntime(), "not-a-uuid");

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errorCode: "4000",
      details: [{ field: "id" }],
    });
  });
});
