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
    enableFishIntegration = config.programs.fish.enable;
  };

  programs.atuin = {
    enable = true;
    enableZshIntegration = config.programs.zsh.enable;
    enableFishIntegration = config.programs.fish.enable;
    settings = {
      enter_accept = true;
      style = "compact";
    };
  };

  programs.bat = {
    enable = true;
    themes = {
      CatppuccinMocha = {
        src = specialArgs.inputs.catppuccin-bat;
        file = "themes/Catppuccin Mocha.tmTheme";
      };
    };
    config = {
      theme = "Catppuccin Mocha";
    };
  };

  home.shell = {
    enableShellIntegration = true;
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

  programs.fish = {
    enable = true;
    shellInit = ''
      function fish_mode_prompt
      end

      function fish_prompt
        set -l last_status $status

        echo -ne "\n"(set_color -b white black) "id" (set_color -b 14b3a0 white) (whoami)@(hostname -s) (set_color normal)
        echo -n " "

        echo -n (set_color -b white black) "dir" (set_color -b magenta white) (prompt_pwd) (set_color normal)
        echo -n " "

        if test "$last_status" -ne 0
          echo -n (set_color -b white black) "code" (set_color -b red white) $last_status (set_color normal)
          echo -n " "
        end

        if test -n "$IN_NIX_SHELL"
          echo -n (set_color -b white black) "nix" (set_color -b yellow black) "$name" (set_color normal)
          echo -n " "
        end

        echo -ne "\nλ "
      end

      set -U fish_greeting

      if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
        source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
      end

      # extend PATH
      fish_add_path "$HOME/.local/bin"
      fish_add_path "$HOME/.cargo/bin"
      fish_add_path "$HOME/.claude/local"
    '';
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
