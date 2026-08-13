import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const DEFAULT_EXTRA_TOOLS = ["grep", "find", "ls"];

export default function enableDefaultTools(pi: ExtensionAPI): void {
  pi.on("session_start", () => {
    const availableTools = new Set(pi.getAllTools().map((tool) => tool.name));
    const activeTools = pi.getActiveTools();
    const toolsToEnable = DEFAULT_EXTRA_TOOLS.filter(
      (tool) => availableTools.has(tool) && !activeTools.includes(tool),
    );

    if (toolsToEnable.length > 0) {
      pi.setActiveTools([...activeTools, ...toolsToEnable]);
    }
  });
}
