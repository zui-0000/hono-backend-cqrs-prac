@summary("RespondedAt")
@doc("レスポンス日時 (RFC 3339 / ISO 8601, PostgreSQL TIMESTAMPTZ互換)")
@example(RespondedAt.fromISO("2025-01-01T12:00:00Z"))
scalar RespondedAt extends utcDateTime;
