import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  SandboxRuntimeConfigSchema,
  type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";

export interface ExtensionSandboxConfig extends SandboxRuntimeConfig {
  enabled: boolean;
}

export interface PolicySource {
  path: string;
  scope: "default" | "global" | "project";
  loaded: boolean;
  ignored?: boolean;
}

export interface LoadedPolicy {
  config: ExtensionSandboxConfig;
  runtimeConfig: SandboxRuntimeConfig;
  sources: PolicySource[];
}

export const DEFAULT_CONFIG: ExtensionSandboxConfig = {
  enabled: true,
  network: {
    allowedDomains: [],
    deniedDomains: [],
    strictAllowlist: true,
  },
  filesystem: {
    denyRead: [],
    allowRead: [],
    allowWrite: ["."],
    denyWrite: ["**/.env", "**/.env.*", "**/*.key", "**/*.pem", "**/sandbox.json"],
  },
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneConfigValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map((entry) => cloneConfigValue(entry)) as T;
  if (isObject(value)) {
    const result: JsonObject = Object.create(null) as JsonObject;
    for (const [key, entry] of Object.entries(value)) {
      result[key] = cloneConfigValue(entry);
    }
    return result as T;
  }
  return structuredClone(value);
}

function dedupeArray(values: unknown[]): unknown[] {
  const primitives = new Set<string>();
  const result: unknown[] = [];
  for (const value of values) {
    const key = value !== null && typeof value === "object" ? `json:${JSON.stringify(value)}` : `${typeof value}:${String(value)}`;
    if (!primitives.has(key)) {
      primitives.add(key);
      result.push(value);
    }
  }
  return result;
}

/** Recursively merge objects; arrays are additive and stable-deduplicated. */
export function mergeConfig<T>(base: T, override: unknown): T {
  if (Array.isArray(base) && Array.isArray(override)) {
    return dedupeArray([...base, ...override]) as T;
  }
  if (isObject(base) && isObject(override)) {
    const result: JsonObject = Object.create(null) as JsonObject;
    for (const [key, value] of Object.entries(base)) {
      result[key] = cloneConfigValue(value);
    }
    for (const [key, value] of Object.entries(override)) {
      result[key] = Object.hasOwn(result, key) ? mergeConfig(result[key], value) : cloneConfigValue(value);
    }
    return result as T;
  }
  return cloneConfigValue(override) as T;
}

export function mergePolicyObjects(
  globalPolicy: unknown,
  projectPolicy: unknown,
  projectTrusted: boolean,
): unknown {
  let merged: unknown = cloneConfigValue(DEFAULT_CONFIG);
  if (globalPolicy !== undefined) merged = mergeConfig(merged, globalPolicy);
  if (projectTrusted && projectPolicy !== undefined) merged = mergeConfig(merged, projectPolicy);
  return merged;
}

function assertKnownKeys(input: unknown, parsed: unknown, path = "configuration"): void {
  if (Array.isArray(input)) {
    if (!Array.isArray(parsed)) return;
    for (let index = 0; index < input.length; index++) {
      assertKnownKeys(input[index], parsed[index], `${path}[${index}]`);
    }
    return;
  }
  if (!isObject(input)) return;
  if (!isObject(parsed)) return;
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(parsed, key)) throw new Error(`Unknown sandbox configuration key: ${path}.${key}`);
    assertKnownKeys(value, parsed[key], `${path}.${key}`);
  }
}

const UNSUPPORTED_ENV_CREDENTIAL_KEYS = ["envVars", "awsPairs", "sigv4"] as const;
const DISTRIBUTED_NOTIFICATION_SERVICE_PREFIX = "com.apple.distributed_notifications";
const DARWIN_NOTIFICATION_SERVICE = "com.apple.system.notification_center";

function blockedNotificationBroker(rule: string): string | undefined {
  if (!rule.endsWith("*")) {
    if (rule.startsWith(DISTRIBUTED_NOTIFICATION_SERVICE_PREFIX)) {
      return DISTRIBUTED_NOTIFICATION_SERVICE_PREFIX;
    }
    return rule === DARWIN_NOTIFICATION_SERVICE ? DARWIN_NOTIFICATION_SERVICE : undefined;
  }

  const prefix = rule.slice(0, -1);
  if (
    prefix.startsWith(DISTRIBUTED_NOTIFICATION_SERVICE_PREFIX)
    || DISTRIBUTED_NOTIFICATION_SERVICE_PREFIX.startsWith(prefix)
  ) {
    return DISTRIBUTED_NOTIFICATION_SERVICE_PREFIX;
  }
  return DARWIN_NOTIFICATION_SERVICE.startsWith(prefix)
    ? DARWIN_NOTIFICATION_SERVICE
    : undefined;
}

function assertNoNotificationBrokerMachLookups(config: SandboxRuntimeConfig): void {
  for (const [index, rule] of (config.network.allowMachLookup ?? []).entries()) {
    const blocked = blockedNotificationBroker(rule);
    if (!blocked) continue;
    throw new Error(
      `Invalid sandbox configuration: network.allowMachLookup.${index} (${JSON.stringify(rule)}) intersects blocked notification broker namespace ${JSON.stringify(blocked)}; global distributed and Darwin notification IPC cannot be enabled for sandboxed execution`,
    );
  }
}

function assertNoEnvCredentialSettings(value: JsonObject): void {
  const credentials = value.credentials;
  if (!isObject(credentials)) return;
  const unsupported = UNSUPPORTED_ENV_CREDENTIAL_KEYS
    .filter((key) => Object.hasOwn(credentials, key))
    .map((key) => `credentials.${key}`);
  if (unsupported.length === 0) return;

  const settings = unsupported.join(", ");
  throw new Error(
    `Invalid sandbox configuration: ${settings} ${unsupported.length === 1 ? "is" : "are"} unsupported because this extension does not filter inherited environment variables. Remove ${settings} and sanitize Pi's launch environment if environment values must be isolated.`,
  );
}

/** Validate the extension's enabled flag and Sandbox Runtime's complete schema. */
export function validatePolicy(value: unknown): ExtensionSandboxConfig {
  if (!isObject(value)) throw new Error("Sandbox configuration must be a JSON object");
  if (typeof value.enabled !== "boolean") throw new Error("Sandbox configuration enabled must be a boolean");
  assertNoEnvCredentialSettings(value);

  const { enabled, ...runtimeInput } = value;
  const result = SandboxRuntimeConfigSchema.safeParse(runtimeInput);
  if (!result.success) {
    const issue = result.error.issues
      .map((entry) => `${entry.path.length ? entry.path.join(".") : "configuration"}: ${entry.message}`)
      .join("; ");
    throw new Error(`Invalid sandbox configuration: ${issue}`);
  }
  assertKnownKeys(runtimeInput, result.data);
  assertNoNotificationBrokerMachLookups(result.data);
  if (result.data.network.strictAllowlist === false) {
    throw new Error(
      "Invalid sandbox configuration: network.strictAllowlist must be true or omitted; keep strict mode enabled and add required destinations to network.allowedDomains",
    );
  }
  return { ...result.data, enabled };
}

async function readOptionalJson(path: string): Promise<{ found: boolean; value?: unknown }> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { found: false };
    throw new Error(`Could not read sandbox policy ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return { found: true, value: JSON.parse(text) };
  } catch (error) {
    throw new Error(`Could not parse sandbox policy ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface LoadPolicyOptions {
  agentDir: string;
  cwd: string;
  configDirName: string;
  projectTrusted: boolean;
}

export async function loadPolicy(options: LoadPolicyOptions): Promise<LoadedPolicy> {
  const globalPath = join(options.agentDir, "sandbox.json");
  const projectPath = join(options.cwd, options.configDirName, "sandbox.json");
  const sources: PolicySource[] = [{ path: "<extension defaults>", scope: "default", loaded: true }];

  const global = await readOptionalJson(globalPath);
  sources.push({ path: globalPath, scope: "global", loaded: global.found });

  let project: { found: boolean; value?: unknown } = { found: false };
  if (options.projectTrusted) {
    project = await readOptionalJson(projectPath);
    sources.push({ path: projectPath, scope: "project", loaded: project.found });
  } else {
    sources.push({ path: projectPath, scope: "project", loaded: false, ignored: true });
  }

  const config = validatePolicy(mergePolicyObjects(global.value, project.value, options.projectTrusted));
  const { enabled: _enabled, ...runtimeConfig } = config;
  return { config, runtimeConfig, sources };
}

export function policyRuleCounts(config: ExtensionSandboxConfig): Record<string, number> {
  return {
    allowedDomains: config.network.allowedDomains.length,
    deniedDomains: config.network.deniedDomains.length,
    denyRead: config.filesystem.denyRead.length,
    allowRead: config.filesystem.allowRead?.length ?? 0,
    allowWrite: config.filesystem.allowWrite.length,
    denyWrite: config.filesystem.denyWrite.length,
    unixSockets: config.network.allowUnixSockets?.length ?? 0,
  };
}
