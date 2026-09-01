import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** Inspection-only integration fixture. It intentionally registers no tools. */
export default function inspectExtension(pi: ExtensionAPI) {
  pi.registerCommand("assert-tools", {
    description: "Assert the exact active tool-name sequence",
    handler: async (args, ctx) => {
      const expected = args.trim() ? args.split(",").map((name) => name.trim()).filter(Boolean) : [];
      const actual = pi.getActiveTools();
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Active tools mismatch: expected [${expected.join(", ")}], got [${actual.join(", ")}]`);
      }
      const definitions = pi.getAllTools()
        .filter((tool) => actual.includes(tool.name))
        .map((tool) => `${tool.name}=${tool.sourceInfo.path}`);
      const output = `Active tools OK: ${actual.join(",")}\n${definitions.join("\n")}`;
      if (ctx.hasUI) ctx.ui.notify(output, "info");
      else console.log(output);
    },
  });
}
