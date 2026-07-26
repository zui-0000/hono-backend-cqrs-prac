import "./Uuid.tsp";

@summary("RequestId")
@doc("リクエストの相関ID (UUID v7)。クライアントが採番し、サーバーのログと突き合わせて追跡する")
@example("018eef15-1234-7123-8123-123456789abc")
scalar RequestId extends Uuid;
