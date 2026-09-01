export const SUPPORTED_PLATFORMS = ["darwin"] as const;
export const PLATFORM_SUPPORT_MESSAGE = "pi-anthropic-sandbox-runtime supports only macOS";

/** Whether a Node host platform is covered by this extension's support contract. */
export function isSupportedPlatform(platform: NodeJS.Platform = process.platform): boolean {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(platform);
}

/** Reject unsupported hosts before configuration can disable sandbox enforcement. */
export function assertSupportedPlatform(platform: NodeJS.Platform = process.platform): void {
  if (!isSupportedPlatform(platform)) {
    throw new Error(`${PLATFORM_SUPPORT_MESSAGE} (detected ${platform})`);
  }
}
