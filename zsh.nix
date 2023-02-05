{
  pkgs,
  specialArgs,
  ...
}: {
  programs.zsh = {
    enable = true;

    oh-my-zsh = {
      enable = true;

      custom = builtins.toString (pkgs.runCommand "omz-custom" {} ''
        mkdir -p $out/plugins
        cp -rv ${./omz-custom}/* $out
        ln -sv ${specialArgs.inputs.omz-nix-shell-plugin} $out/plugins/nix-shell
      '');

      theme = "ole";
      plugins = ["git" "nix-shell"];

      extraConfig = ''
        # env vars
        export LESS=-FRX
        export EDITOR=hx
        export MAKEFLAGS=-j12

        # aliases
        alias ls='ls --color=auto'
        alias grep='grep --color=auto'
        alias g=git
        alias s=stg

        # direnv
        eval "$(direnv hook zsh)"
      '';
    };
  };
}
