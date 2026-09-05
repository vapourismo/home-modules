import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { createMuxProxyServer } from "@anthropic-ai/sandbox-runtime/dist/sandbox/mux-proxy.js";

const IS_MACOS = process.platform === "darwin";

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

test("mux proxy uses a short private socket path when TMPDIR exceeds macOS sun_path", {
  skip: !IS_MACOS,
  concurrency: false,
}, async () => {
  const root = await mkdtemp("/tmp/pi-srt-mux-test-");
  const longTmpdir = path.join(root, "nested".repeat(16));
  await mkdir(longTmpdir, { recursive: true });

  const originalTmpdir = process.env.TMPDIR;
  const httpServer = createHttpServer((_request, response) => response.end("ok"));
  const mux = createMuxProxyServer({
    httpServer,
    handleSocksConnection: (socket) => socket.destroy(),
  });
  let backendPath: string | undefined;

  try {
    process.env.TMPDIR = longTmpdir;
    await mux.listenHttpBackend();
    const address = httpServer.address();
    assert.equal(typeof address, "string");
    backendPath = address as string;
    assert.ok(Buffer.byteLength(backendPath) <= 103, backendPath);
    assert.match(backendPath, /^\/tmp\/srt-mux-[^/]+\/http\.sock$/);
  } finally {
    if (originalTmpdir === undefined) delete process.env.TMPDIR;
    else process.env.TMPDIR = originalTmpdir;
    await mux.close();
    await rm(root, { recursive: true, force: true });
  }

  assert.ok(backendPath);
  assert.equal(await pathExists(path.dirname(backendPath)), false);
});
