import { ManagedRuntime } from "effect";

import { createApp } from "~/app";
import { AppLayer } from "~/runtime";

// エントリポイント。本番の依存 (AppLayer) からランタイムを一度だけ構築し、
// それを注入したアプリを Bun のサーバとして公開する。
const runtime = ManagedRuntime.make(AppLayer);
const app = createApp(runtime);

export default {
  port: 3000,
  fetch: app.fetch,
};
