import { Hono } from "hono";
import { createUserController } from "~/contexts/user/presentation/create-user-controller";
import type { AppRuntime } from "~/runtime";

/**
 * ルーティングを定義した Hono アプリを組み立てる。パスは TypeSpec の @route と対応する。
 *
 * ランタイム (= 構築済みの依存) を引数で受け取り、各 controller に注入する。
 * 依存の差し替え点をこの一箇所に集めることで、テストでは fake の Layer から
 * 作ったランタイムを渡すだけで、HTTP 境界ごと検証できる。
 */
export const createApp = (runtime: AppRuntime) => {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/users", createUserController(runtime));

  return app;
};
