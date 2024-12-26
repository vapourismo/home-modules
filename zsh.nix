{
  pkgs,
  specialArgs,
  ...
}: {
  programs.atuin = {
    enable = true;
    settings = {
      enter_accept = true;
      style = "compact";
    };
  };

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
      alias t=task

      # extend PATH
      export PATH="$PATH:$HOME/.local/bin:$HOME/.cargo/bin"

      # put /usr/bin last in PATH
      path=(''${path[@]:#/usr/bin})
      path+=(/usr/bin)
    '';

    oh-my-zsh = {
      enable = true;

      custom = builtins.toString (pkgs.runCommand "omz-custom" {} ''
        mkdir -p $out/plugins
        cp -rv ${./omz-custom}/* $out
        ln -sv ${specialArgs.inputs.omz-nix-shell-plugin} $out/plugins/nix-shell
      '');

      theme = "ole";
      plugins = ["nix-shell"];
    };
  };
}
