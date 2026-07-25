@summary("Uuid")
@doc("UUID v7")
@example("018eef15-1234-7123-8123-123456789abc")
@pattern("^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
scalar Uuid extends string;
