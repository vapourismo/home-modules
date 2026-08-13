import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function setCargoTermQuiet(_pi: ExtensionAPI): void {
  process.env.CARGO_TERM_QUIET = "true";
}
