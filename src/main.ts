import { Hono } from "hono";
import { createUserController } from "~/features/user/presentation/create-user-controller";

// ルーティング定義。パスは TypeSpec の @route と対応する。
// 処理は各 feature の controller に委譲し、ここでは対応付けのみを持つ。
const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.post("/users", createUserController);

export default {
  port: 3000,
  fetch: app.fetch,
};
