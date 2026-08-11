{ ... }: {
  programs.pi-coding-agent = {
    enable = true;
    package = null;
    context = ./pi-agents.md;
    settings = {
      theme = "dark/dark";
      defaultProvider = "openai-codex";
      defaultModel = "gpt-5.6-sol";
      defaultThinkingLevel = "xhigh";
      packages = [
        "npm:pi-web-access"
        "npm:pi-landstrip"
        "npm:@narumitw/pi-usage"
        "npm:@juicesharp/rpiv-ask-user-question"
        "npm:pi-codex-fast-mode"
        "npm:@narumitw/pi-plan-mode"
      ];
      quietStartup = true;
      enableInstallTelemetry = false;
      hideThinkingBlock = false;
      fullscreenScrollbar = "auto";
      tuiMode = "regular";
    };
  };

  home.file = {
    ".pi/agent" = {
      source = ./pi;
      recursive = true;
    };
  };
}
