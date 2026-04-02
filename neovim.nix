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
    package =
      let
        neovidePackage =
          specialArgs.inputs.nixpkgs-master.legacyPackages.${pkgs.stdenv.hostPlatform.system}.neovide;
      in
      neovidePackage.overrideAttrs (old: {
        src = specialArgs.inputs.neovide;
      });
  };
}
