import { Hono } from "hono";

import {
  CreateUser201Response,
  CreateUserBody,
  CreateUserHeader,
  DeleteUserHeader,
  DeleteUserParams,
  GetUser200Response,
  GetUserHeader,
  GetUserParams,
  UpdateUserBody,
  UpdateUserHeader,
  UpdateUserParams,
} from "~/generated/users";
import { handleWithEffect } from "~/shared/presentation/handle-with-effect";
import { HttpStatus } from "~/shared/presentation/http-status";

import type { UserRuntime } from "../user-runtime";
import { createUserController } from "./create-user-controller";
import { deleteUserController } from "./delete-user-controller";
import { getUserController } from "./get-user-controller";
import { updateUserController } from "./update-user-controller";

/**
 * user コンテキストの HTTP 経路。パスは TypeSpec の @route と対応する
 * (このルータ自体は app.ts が "/users" にマウントするので、ここでは相対パス)。
 *
 * **HTTP 契約の宣言をここに集約している** — 入力 (header / body / params) も
 * 出力 (status / responseSchema) も、このファイルを見れば一望できる。
 * controller 側は検証済みの入力を受け取ってユースケースを呼ぶだけ。
 *
 * 生成スキーマ (`~/generated`) を import してよいのは presentation 層だけなので、
 * この結び付けを app.ts (src 直下) に置くことはできない。
 */
export const userRoutes = (runtime: UserRuntime): Hono => {
  const routes = new Hono();

  routes.post(
    "/",
    handleWithEffect({
      request: { header: CreateUserHeader, body: CreateUserBody },
      response: { status: HttpStatus.Created, body: CreateUser201Response },
      controller: createUserController,
    })(runtime),
  );

  routes.get(
    "/:id",
    handleWithEffect({
      request: { header: GetUserHeader, params: GetUserParams },
      response: { status: HttpStatus.Ok, body: GetUser200Response },
      controller: getUserController,
    })(runtime),
  );

  routes.put(
    "/:id",
    handleWithEffect({
      request: {
        header: UpdateUserHeader,
        body: UpdateUserBody,
        params: UpdateUserParams,
      },
      response: { status: HttpStatus.NoContent },
      controller: updateUserController,
    })(runtime),
  );

  routes.delete(
    "/:id",
    handleWithEffect({
      request: { header: DeleteUserHeader, params: DeleteUserParams },
      response: { status: HttpStatus.NoContent },
      controller: deleteUserController,
    })(runtime),
  );

  return routes;
};
