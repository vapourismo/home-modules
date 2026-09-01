import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertSupportedPlatform,
  isSupportedPlatform,
  PLATFORM_SUPPORT_MESSAGE,
  SUPPORTED_PLATFORMS,
} from "../src/platform.ts";

test("only macOS is supported", () => {
  assert.deepEqual(SUPPORTED_PLATFORMS, ["darwin"]);
  assert.equal(isSupportedPlatform("darwin"), true);
  assert.doesNotThrow(() => assertSupportedPlatform("darwin"));
});

test("Linux and other Node platforms are rejected with the macOS-only support message", () => {
  assert.equal(PLATFORM_SUPPORT_MESSAGE, "pi-anthropic-sandbox-runtime supports only macOS");
  for (const platform of ["linux", "win32", "freebsd"] as const) {
    assert.equal(isSupportedPlatform(platform), false);
    assert.throws(
      () => assertSupportedPlatform(platform),
      (error: unknown) => error instanceof Error
        && error.message === `${PLATFORM_SUPPORT_MESSAGE} (detected ${platform})`,
    );
  }
});

test("package and lockfile advertise the same macOS-only support", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const packageLock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));

  assert.equal(packageJson.description, "Pi extension enforcing Anthropic Sandbox Runtime policies on macOS");
  assert.deepEqual(packageJson.os, [...SUPPORTED_PLATFORMS]);
  assert.deepEqual(packageLock.packages[""].os, packageJson.os);
});
