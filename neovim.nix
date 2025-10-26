{ pkgs, ... }:
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

  home.sessionVariables = {
    EDITOR = "nvim";
  };

  home.file = {
    ".config/nvim" = {
      source = ./neovim;
      recursive = true;
    };
  };
}
