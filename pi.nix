{ pkgs, ... }:
let
  sandboxRuntimeExtension = pkgs.buildNpmPackage {
    pname = "pi-anthropic-sandbox-runtime";
    version = "0.0.0";
    src = pkgs.nix-gitignore.gitignoreSource [ ] ./pi/sandbox-runtime;
    npmDepsHash = "sha256-Sne3S8SKv+YRdl8JRenmp7WWniPNx3C/PvLzHM9Pqco=";
    makeCacheWritable = true;
    npmBuildScript = "build";
    doCheck = true;
    nativeCheckInputs = [
      pkgs.bashInteractive
      pkgs.clang
      pkgs.python3
      pkgs.which
    ];
    installPhase = ''
      runHook preInstall
      npm prune --omit=dev --no-save
      mkdir -p "$out"
      cp README.md package.json package-lock.json index.ts helper.mjs "$out/"
      cp -R src node_modules "$out/"
      test -d "$out/node_modules/@anthropic-ai/sandbox-runtime"
      proxyAgentJar="$out/node_modules/@anthropic-ai/sandbox-runtime/vendor/java-proxy-agent/srt-proxy-agent.jar"
      test -f "$proxyAgentJar"
      test -s "$proxyAgentJar"
      test "$(wc -c < "$proxyAgentJar")" -eq 12144
      test "$(sha256sum "$proxyAgentJar" | cut -d ' ' -f 1)" = \
        "506a2995d055d5c3046b55c9a51cf905e9f24f535bce39c61b9b5ba0955424f9"
      test ! -e "$out/node_modules/typescript"
      test ! -e "$out/node_modules/typebox"
      test ! -e "$out/node_modules/@types/node"
      test ! -e "$out/node_modules/@earendil-works/pi-ai"
      test ! -e "$out/node_modules/@earendil-works/pi-coding-agent"
      test ! -e "$out/node_modules/@earendil-works/pi-tui"
      runHook postInstall
    '';
  };
in
{
  programs.pi-coding-agent = {
    enable = true;
    package = null;
    context = ./pi-agents.md;
    settings = {
      theme = "dark/dark";
      defaultProvider = "openai-codex";
      defaultModel = "gpt-6-astra";
      defaultThinkingLevel = "high";
      packages = [
        "${sandboxRuntimeExtension}"
        "npm:pi-web-access"
        "npm:@juicesharp/rpiv-ask-user-question"
        "npm:@narumitw/pi-usage"
        "npm:@narumitw/pi-plan-mode"
        "npm:@narumitw/pi-codex-compact"
      ];
      quietStartup = true;
      enableInstallTelemetry = false;
      hideThinkingBlock = false;
      fullscreenScrollbar = "auto";
      tuiMode = "regular";
    };
  };

  home.file = {
    ".pi/agent/sandbox.json".source = ./pi/sandbox.json;
    ".pi/agent/extensions" = {
      source = ./pi/extensions;
      recursive = true;
    };
  };
}
