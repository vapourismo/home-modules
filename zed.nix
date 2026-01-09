{ pkgs, ... }:
{
  programs.zed-editor = {
    enable = true;
    package = pkgs.hello; # Use system Zed installation
    mutableUserKeymaps = true;
    mutableUserSettings = true;
    userKeymaps = import ./zed/keymaps.nix;
    userSettings = import ./zed/settings.nix;
  };
}
