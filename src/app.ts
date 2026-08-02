import { Hono } from "hono";

import type { AppRuntime } from "~/app-runtime";
import { userRoutes } from "~/contexts/user/presentation/user-routes";

/**
 * アプリ全体を組み立てる。
 *
 * ここが知っているのは「どのコンテキストを、どのパスにマウントするか」だけ。
 * 個々のエンドポイント (メソッド・ステータス・応答スキーマ) は各コンテキストの
 * `*-routes.ts` が持つので、エンドポイントが増えてもこのファイルは育たない。
 *
 * ランタイム (= 構築済みの依存) を引数で受け取り、各ルータへ渡す。
 * 依存の差し替え点をこの一箇所に集めることで、テストでは fake の Layer から
 * 作ったランタイムを渡すだけで、HTTP 境界ごと検証できる。
 */
export const createApp = (runtime: AppRuntime) => {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/users", userRoutes(runtime));

  return app;
};
