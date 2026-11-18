{
  lib,
  pkgs,
  specialArgs,
  ...
}:
let
  neovimSrc = specialArgs.inputs.neovim;

  treesitterAttrsForSuffix =
    let
      treesitterDepsLines = lib.filter (lib.strings.hasPrefix "TREESITTER_") (
        lib.splitString "\n" (lib.readFile "${neovimSrc}/cmake.deps/deps.txt")
      );
    in
    suffix:
    lib.listToAttrs (
      lib.concatMap (
        line:
        let
          match = lib.match "TREESITTER_([A-Z0-9]+)_${suffix} (.+)" line;
          name = lib.toLower (lib.elemAt match 0);
          value = lib.elemAt match 1;
        in
        lib.optional (match != null) (lib.nameValuePair name value)
      ) treesitterDepsLines
    );

  treesitterSrcs =
    let
      treesitterUrls = treesitterAttrsForSuffix "URL";
      treesitterSha256 = treesitterAttrsForSuffix "SHA256";
    in
    lib.mapAttrs (name: url: {
      inherit url;
      sha256 = treesitterSha256.${name};
    }) treesitterUrls;

  neovimNightlyOverlay =
    final: prev:
    let
      neovimWithParsers = prev.neovim-unwrapped.override {
        treesitter-parsers = lib.mapAttrs (_: info: { src = final.fetchurl info; }) treesitterSrcs;
      };
    in
    {
      neovim-unwrapped = neovimWithParsers.overrideAttrs {
        version = "0.13.0-dev";
        src = neovimSrc;
      };
    };
in
{
  nixpkgs.overlays = [
    neovimNightlyOverlay
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
