import { Hono } from "hono";

import {
  Refresh200Response,
  RefreshBody,
  RefreshHeader,
} from "~/generated/auth";
import { HttpStatus } from "~/shared/presentation/constants/http-status";
import { handleWithEffect } from "~/shared/presentation/handle-with-effect";

import type { AuthRuntime } from "../auth-runtime";
import { refreshController } from "./refresh-controller";

/**
 * auth コンテキストの HTTP 経路。パスは TypeSpec の @route と対応する
 * (このルータ自体は app.ts が "/auth" にマウントするので、ここでは相対パス)。
 *
 * login / logout は未実装。login は user 側に読み取りポートを新設してから、
 * logout は Bearer の検証ミドルウェアが入ってから足す
 * (どちらも docs/05-auth/01-our-approach.md に段取りがある)。
 */
export const authRoutes = (runtime: AuthRuntime): Hono => {
  const routes = new Hono();

  routes.post(
    "/refresh",
    handleWithEffect({
      request: { header: RefreshHeader, body: RefreshBody },
      response: { status: HttpStatus.Ok, body: Refresh200Response },
      controller: refreshController,
    })(runtime),
  );

  return routes;
};
