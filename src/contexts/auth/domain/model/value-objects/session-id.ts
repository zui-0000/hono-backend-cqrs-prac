import { Schema } from "effect";

import { Uuid } from "~/shared/domain/model/uuid";
import { generateBrandedUuid } from "~/shared/domain/uuid-generator";

/**
 * セッションの識別子 (値オブジェクト / branded uuidv7)。
 *
 * **ログインからログアウトまでを貫き、ローテーションを跨いでも変わらない。**
 * リフレッシュトークンは更新のたびに別の行になるが、同じセッションに属する行は
 * この id を共有する。失効の単位もこれ (ログアウトはセッションごと切る)。
 *
 * アクセストークン (JWT) の sid クレームに載せるのもこの値。券 1 枚の id を載せると
 * 古いタブからのログアウトが空振りするため
 * (docs/05-auth/01-our-approach.md「session_id を別に持つ理由」)。
 *
 * 券そのものと違って**推測されても困らない**ので uuidv7 でよい。
 * 券のほうは予測できないことが要件なので、RefreshTokenIssuer が暗号論的乱数から作る。
 */
export const SessionId = Uuid.pipe(Schema.brand("Auth.SessionId"));
export type SessionId = typeof SessionId.Type;

/** 新しいセッションの識別子を採番する (ログイン時)。 */
export const generateSessionId = generateBrandedUuid(SessionId);
