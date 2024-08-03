{
  pkgs,
  lib,
  specialArgs,
  ...
}: {
  home.packages = let
    atuin = specialArgs.inputs.atuin.packages.${pkgs.system}.default.overrideAttrs (old: {
      buildInputs =
        (old.buildInputs or [])
        ++ lib.optional pkgs.stdenv.isDarwin pkgs.darwin.apple_sdk.frameworks.AppKit;
    });
  in [
    atuin
  ];

  programs.zsh = {
    enable = true;

    initExtra = ''
      # env vars
      export LESS=-FRX
      export MAKEFLAGS=-j12

      # aliases
      alias ls='ls --color=auto'
      alias ll='ls --color=auto -lhF'
      alias grep='grep --color=auto'
      alias g=git
      alias s=stg
      alias c=cargo

      # atuin
      eval "$(atuin init zsh)"

      # Extend PATH
      export PATH="$PATH:$HOME/.local/bin"
    '';

    oh-my-zsh = {
      enable = true;

      custom = builtins.toString (pkgs.runCommand "omz-custom" {} ''
        mkdir -p $out/plugins
        cp -rv ${./omz-custom}/* $out
        ln -sv ${specialArgs.inputs.omz-nix-shell-plugin} $out/plugins/nix-shell
      '');

      theme = "ole";
      plugins = ["git" "nix-shell"];
    };
  };
}
