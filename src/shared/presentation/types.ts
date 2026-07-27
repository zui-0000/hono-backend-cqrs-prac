import type { UserRepository } from "~/features/user/domain/user-repository";
import type { PasswordHasher } from "~/shared/service/password-hasher";
import type { UuidGenerator } from "~/shared/service/uuid-generator";

/**
 * アプリケーションが提供するサービス (Layer で注入される依存) の総体。
 * presentation 層のハンドラはこれらを要求する Effect を実行できる。
 */
export type AppServices = UserRepository | PasswordHasher | UuidGenerator;
