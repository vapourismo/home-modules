{ ... }: {
  programs.opencode = {
    enable = true;
    package = null;
    context = ./opencode-agents.md;
    tui = {
      mouse = false;
      attention = {
        enabled = true;
        notifications = true;
        sound = false;
      };
      keybinds = {
        messages_half_page_up = "alt+u";
        messages_half_page_down = "alt+d";
      };
    };
    settings = {
      autoshare = false;
      autoupdate = true;
      snapshot = false;
      experimental = {
        continue_loop_on_deny = true;
      };
    };
  };
}
