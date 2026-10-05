import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const HOST_PACKAGES = [
  "@earendil-works/pi-ai",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
  "typebox",
];

test("development host dependencies are pinned and locked to one shared version", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
  const piVersion = manifest.devDependencies["@earendil-works/pi-coding-agent"];

  for (const name of HOST_PACKAGES) {
    const version = manifest.devDependencies[name];
    assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must be pinned`);
    if (name !== "typebox") assert.equal(version, piVersion, `${name} must match Pi`);
    assert.equal(lock.packages[""].devDependencies[name], version);
    assert.equal(lock.packages[`node_modules/${name}`].version, version);

    // Duplicate AI modules split provider registries; duplicate TUI modules
    // can give the approval inspector incompatible class types.
    const copies = Object.keys(lock.packages).filter(
      (key) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`),
    );
    assert.deepEqual(copies, [`node_modules/${name}`], `${name} must be deduplicated`);
  }
});
