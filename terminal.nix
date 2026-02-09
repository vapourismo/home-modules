{
  pkgs,
  lib,
  specialArgs,
  config,
  ...
}:
{
  home.packages =
    # Bash on MacOS is too old for Nix shells to work properly
    lib.optional pkgs.stdenv.isDarwin pkgs.bash;

  programs.direnv = {
    enable = true;
    enableZshIntegration = config.programs.zsh.enable;
  };

  programs.atuin = {
    enable = true;
    enableZshIntegration = config.programs.zsh.enable;
    settings = {
      enter_accept = true;
      style = "compact";
    };
  };

  home.shell = {
    enableZshIntegration = config.programs.zsh.enable;
  };

  home.shellAliases = {
    ls = "ls --color=auto";
    ll = "ls --color=auto -lhF";
    tree = "tree --gitignore";
    grep = "grep --color=auto";
    g = "git";
    c = "cargo";
  };

  home.sessionVariables = {
    LESS = "-FRX";
    MAKEFLAGS = "-j12";
  };

  programs.zsh = {
    enable = true;

    initContent = ''
      # Make matcher fuzzy
      zstyle ':completion:*' matcher-list "" \
        'm:{a-z\-}={A-Z\_}' \
        'r:[^[:alpha:]]||[[:alpha:]]=** r:|=* m:{a-z\-}={A-Z\_}' \
        'r:|?=** m:{a-z\-}={A-Z\_}'

      # extend PATH
      path+=($HOME/.local/bin)
      path+=($HOME/.cargo/bin)
      path+=($HOME/.claude/local)

      # put /usr/bin last in PATH
      path=(''${path[@]:#/usr/bin})
      path+=(/usr/bin)
    '';

    oh-my-zsh = {
      enable = true;

      custom = toString (
        pkgs.runCommand "omz-custom" { } ''
          mkdir -p $out/plugins
          cp -rv ${./omz-custom}/* $out
          ln -sv ${specialArgs.inputs.omz-nix-shell-plugin} $out/plugins/nix-shell
          ln -sv ${specialArgs.inputs.omz-autocomplete-plugin} $out/plugins/zsh-autocomplete
        ''
      );

      theme = "ole";
      plugins = [
        "nix-shell"
        "zsh-autocomplete"
      ];
    };
  };
}
