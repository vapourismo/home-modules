{
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
}
