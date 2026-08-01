import "./model/index.tsp";

@summary("CreateUserResponse")
model CreateUserResponse {
  // 採番された ID。クライアントはこれを使って GET /users/{id} を呼べる。
  id: UserId;
}
