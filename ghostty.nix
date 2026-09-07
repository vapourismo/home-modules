{
  programs.ghostty = {
    enable = true;
    package = null;
    clearDefaultKeybinds = true;
    settings = {
      theme = "Catppuccin Mocha";
      font-family = "Iosevka Term SS02";
      font-size = 13;
      font-thicken = true;
      adjust-cell-height = 3;
      adjust-cursor-thickness = 2;
      macos-option-as-alt = "left";
      quit-after-last-window-closed = true;
      confirm-close-surface = false;
      auto-update = "check";
      keybind = [
        "cmd+q=close_surface"
        "cmd+shift+,=reload_config"
        "cmd+shift+n=new_window"
        "cmd+shift+w=close_window"
        "alt+tab=goto_window:next"
        "alt+shift+tab=goto_window:previous"
      ];
    };
  };
}
