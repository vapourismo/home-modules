{
  pkgs,
  specialArgs,
  ...
}: {
  home.packages = [
    specialArgs.inputs.atuin.packages.${pkgs.system}.default
  ];

  programs.zsh = {
    enable = true;

    initExtra = ''
      # env vars
      export LESS=-FRX
      export EDITOR=hx
      export MAKEFLAGS=-j12
      export DUNE_CACHE=enabled

      # aliases
      alias ls='ls --color=auto'
      alias ll='ls --color=auto -lhF'
      alias grep='grep --color=auto'
      alias g=git
      alias s=stg

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
