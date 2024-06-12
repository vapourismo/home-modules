{
  specialArgs,
  pkgs,
  ...
}: {
  programs.neovim = {
    enable = true;

    viAlias = true;
    vimAlias = true;

    withNodeJs = true;
  };

  home.packages = with pkgs; [
    neovim-remote
    lua-language-server
  ];

  programs.zsh.initExtra = ''
    alias nvim='nvim --listen /tmp/nvimsocket'
  '';

  home.file = {
    ".config/nvim" = {
      source = ./neovim;
      recursive = true;
    };

    ".local/share/nvim/lazy/lazy.nvim" = {
      source = specialArgs.inputs.nvim-lazy;
      recursive = true;
    };
  };
}
