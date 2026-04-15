{
  lib,
  pkgs,
  specialArgs,
  ...
}:
{
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
    enable = true;
    package = specialArgs.inputs.neovide.packages.${pkgs.stdenv.hostPlatform.system}.default;
  };
}
