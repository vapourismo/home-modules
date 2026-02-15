{ pkgs, specialArgs, ... }:
{
  programs.zed-editor = {
    enable = true;
    package = specialArgs.inputs.zed.packages.${pkgs.stdenv.hostPlatform.system}.default;
    mutableUserKeymaps = true;
    mutableUserSettings = true;
    userKeymaps = import ./zed/keymaps.nix;
    userSettings = import ./zed/settings.nix;
  };
}
