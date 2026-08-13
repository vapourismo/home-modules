import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function setCargoTermQuiet(_pi: ExtensionAPI): void {
  // Make sure Cargo does not pollute the context with unnecessary output.
  process.env.CARGO_TERM_QUIET = "true";

  // If kache or sccache is used, disable it.
  if (
    process.env.RUSTC_WRAPPER?.includes("kache") ||
    process.env.RUSTC_WRAPPER?.includes("sccache")
  ) {
    process.env.RUSTC_WRAPPER = "";
  }
}
