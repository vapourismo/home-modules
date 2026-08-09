{ ... }: {
  programs.codex = {
    enable = true;
    package = null;
    context = ./codex-agents.md;
  };
}
