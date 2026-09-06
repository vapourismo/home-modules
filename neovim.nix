{
  lib,
  pkgs,
  specialArgs,
  ...
}:
{
  nixpkgs.overlays = [
    (final: prev: {
      neovim-unwrapped = prev.neovim-unwrapped.overrideAttrs {
        version = "0.13.0-dev";
        src = specialArgs.inputs.neovim;
      };
    })
  ];

  programs.neovim = {
    enable = true;
    viAlias = true;
    vimAlias = true;
    withNodeJs = true;
  };

  home.packages = with pkgs; [
    neovim-remote
  ];

  home.file = {
    ".config/nvim" = {
      source = ./neovim;
      recursive = true;
    };
  };

  programs.neovide = lib.optionalAttrs pkgs.stdenv.isDarwin {
    enable = false;
    package = specialArgs.inputs.neovide.packages.${pkgs.stdenv.hostPlatform.system}.default;
    settings = {
      system-new-window-hotkey = "";
      system-hide-hotkey = "";
      system-hide-others-hotkey = "";
      system-quit-hotkey = "";
      system-minimize-hotkey = "";
      system-fullscreen-hotkey = "";
      system-show-all-tabs-hotkey = "";
    };
  };
}
