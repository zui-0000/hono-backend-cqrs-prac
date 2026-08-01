import { Schema } from "effect";

import { Uuid } from "~/shared/domain/uuid";
import { generateBrandedUuid } from "~/shared/service/uuid-generator";

/**
 * ユーザーの識別子 (値オブジェクト / branded uuidv7)。形式検証は共有ドメインの Uuid。
 *
 * エクスポート名は所属する集約で修飾する (UserId)。バレル (index.ts) を置かず
 * 各ファイルから直接 import する方針のため、名前だけで文脈が分かる必要がある。
 * 修飾しないと他コンテキストの Id と衝突し、別名 import を強いられる。
 * brand タグも同じ理由でグローバル一意にしておく。
 */
export const UserId = Uuid.pipe(Schema.brand("User.Id"));
export type UserId = typeof UserId.Type;

/** 新規ユーザーの識別子を採番する (共有ヘルパーに委譲)。 */
export const generateUserId = generateBrandedUuid(UserId);
