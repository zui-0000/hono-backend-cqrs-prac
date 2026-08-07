import { ManagedRuntime } from "effect";

import { createApp } from "~/app";
import { AppLayer } from "~/app-runtime";

// エントリポイント。本番の依存 (AppLayer) からランタイムを一度だけ構築し、
// それを注入したアプリを Bun のサーバとして公開する。
const runtime = ManagedRuntime.make(AppLayer);

// ここで Layer を構築しきってから公開する。ManagedRuntime は既定で遅延構築のため、
// これが無いと設定漏れに最初のリクエストまで気付けない (02-architecture.md 参照)。
await runtime.runtime();

const app = createApp(runtime);

export default {
  port: 3000,
  fetch: app.fetch,
};
