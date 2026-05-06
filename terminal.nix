{
  pkgs,
  lib,
  config,
  ...
}:
{
  home.packages =
    # Bash on MacOS is too old for Nix shells to work properly
    lib.optional pkgs.stdenv.isDarwin pkgs.bash;

  programs.direnv = {
    enable = true;
    enableFishIntegration = config.programs.fish.enable;
  };

  programs.atuin = {
    enable = true;
    enableFishIntegration = config.programs.fish.enable;
    settings = {
      enter_accept = true;
      style = "compact";
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

        echo -ne "\n"(set_color -b brblack white) "id" (set_color -b blue black) (whoami)@(hostname -s) (set_color normal)
        echo -n " "

        echo -n (set_color -b brblack white) "dir" (set_color -b green black) (prompt_pwd) (set_color normal)
        echo -n " "

        if test "$last_status" -ne 0
          echo -n (set_color -b brblack white) "code" (set_color -b red brwhite) $last_status (set_color normal)
          echo -n " "
        end

        if test -n "$IN_NIX_SHELL"
          echo -n (set_color -b brblack white) "nix" (set_color -b yellow black) "$name" (set_color normal)
          echo -n " "
        end

        echo -ne "\nλ "
      end

      set -U fish_greeting

      if test -e /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
        source /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.fish
      end

      # load secrets
      if test -e "$HOME/.config/fish/secrets.fish"
        source "$HOME/.config/fish/secrets.fish"
      end

      # extend PATH
      fish_add_path "$HOME/.local/bin"
      fish_add_path "$HOME/.cargo/bin"
      fish_add_path "$HOME/.claude/local"

      # move system PATHs to the end
      function move_path_to_back -a path 
        if set -l index (contains -i "$path" $PATH)
          set -e PATH[$index]
          set -a PATH "$path"
        else
          echo No
        end
      end

      move_path_to_back /usr/bin
      move_path_to_back /usr/sbin
      move_path_to_back /sbin
      move_path_to_back /bin
    '';
  };
}
