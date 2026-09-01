import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const EXPECTED_SIZE = 12_144;
const EXPECTED_SHA256 = "UGopldBV1cMEa1XJpRz5BenyT1NbzjnGG5tboJVUJPk=";
const PROXY_AGENT_URL = new URL(
  "../node_modules/@anthropic-ai/sandbox-runtime/vendor/java-proxy-agent/srt-proxy-agent.jar",
  import.meta.url,
);

test("the local sandbox runtime includes the official Java proxy agent", async () => {
  // Use the package under this extension's node_modules directly. Package-name
  // resolution could otherwise fall back to NODE_PATH or another installation.
  const proxyAgentPath = fileURLToPath(PROXY_AGENT_URL);
  const file = await stat(proxyAgentPath);
  assert.equal(file.isFile(), true);
  assert.ok(file.size > 0);
  assert.equal(file.size, EXPECTED_SIZE);

  const digest = createHash("sha256")
    .update(await readFile(proxyAgentPath))
    .digest("base64");
  assert.equal(digest, EXPECTED_SHA256);
});
