import { Schema } from "effect";

import { Uuid } from "~/shared/domain/model/uuid";
import { generateBrandedUuid } from "~/shared/domain/uuid-generator";

/**
 * リフレッシュトークン 1 枚の識別子 (値オブジェクト / branded uuidv7)。
 *
 * ローテーションのたびに新しい行 = 新しい id になる。
 * セッションを通して不変なのは SessionId のほうで、こちらは券の世代を表す。
 *
 * **券そのものではない。** 券 (クライアントが持つ秘密) は不透明トークンで、
 * DB にはそのハッシュ (RefreshTokenHash) だけが載る。
 * この id は行を指す内部の識別子で、外に出ることはない。
 */
export const RefreshTokenId = Uuid.pipe(Schema.brand("Auth.RefreshTokenId"));
export type RefreshTokenId = typeof RefreshTokenId.Type;

/** 新しい券の識別子を採番する。 */
export const generateRefreshTokenId = generateBrandedUuid(RefreshTokenId);
