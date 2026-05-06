{ ... }:
{
  programs.zed-editor = {
    enable = true;
    package = null;
    mutableUserKeymaps = true;
    mutableUserSettings = true;
    userKeymaps = import ./zed/keymaps.nix;
    userSettings = import ./zed/settings.nix;
  };
}
