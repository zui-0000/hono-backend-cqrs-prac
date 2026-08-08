import { Hono } from "hono";

import {
  Login200Response,
  LoginBody,
  LoginHeader,
  Refresh200Response,
  RefreshBody,
  RefreshHeader,
} from "~/generated/auth";
import { HttpStatus } from "~/shared/presentation/constants/http-status";
import { handleWithEffect } from "~/shared/presentation/handle-with-effect";

import type { AuthRuntime } from "../auth-runtime";
import { loginController } from "./login-controller";
import { refreshController } from "./refresh-controller";

/**
 * auth コンテキストの HTTP 経路。パスは TypeSpec の @route と対応する
 * (このルータ自体は app.ts が "/auth" にマウントするので、ここでは相対パス)。
 *
 * logout は未実装。Bearer の検証ミドルウェアが入ってから足す
 * (段取りは docs/05-auth/01-our-approach.md)。
 */
export const authRoutes = (runtime: AuthRuntime): Hono => {
  const routes = new Hono();

  routes.post(
    "/login",
    handleWithEffect({
      request: { header: LoginHeader, body: LoginBody },
      response: { status: HttpStatus.Ok, body: Login200Response },
      controller: loginController,
    })(runtime),
  );

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
