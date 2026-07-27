import { Schema } from "effect";
import { Uuid } from "~/shared/domain/uuid";
import { generateBrandedUuid } from "~/shared/service/uuid-generator";

/**
 * ユーザーの識別子 (値オブジェクト / branded uuidv7)。形式検証は共有ドメインの Uuid。
 * 利用側は `User.Id` として参照する (bare 名 + namespace)。
 * brand タグはグローバル一意が必要なので "User.Id" と修飾しておく。
 */
export const Id = Uuid.pipe(Schema.brand("User.Id"));
export type Id = typeof Id.Type;

/** 新規ユーザーの識別子を採番する (共有ヘルパーに委譲)。 */
export const generateId = generateBrandedUuid(Id);
