{ ... }: {
  programs.opencode = {
    enable = true;
    package = null;
    context = ./opencode-agents.md;
    tui = {
      mouse = false;
    };
    settings = {
      autoshare = false;
      autoupdate = true;
    };
  };
}
