@summary("UpdatedAt")
@doc("更新日時 (RFC 3339 / ISO 8601, PostgreSQL TIMESTAMPTZ互換)")
@example(UpdatedAt.fromISO("2025-01-01T12:00:00Z"))
scalar UpdatedAt extends utcDateTime;
