{
  config,
  lib,
  pkgs,
  specialArgs,
  ...
}:
{
  options.ole.jj = {
    gpgSignKey = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
    };

    sshSignKey = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
    };

    email = lib.mkOption {
      type = lib.types.str;
      default = "git@ole.lol";
    };
  };

  config.programs.jujutsu = {
    enable = true;

    package =
      specialArgs.inputs.jujutsu.packages.${pkgs.stdenv.hostPlatform.system}.default.overrideAttrs
        {
          doCheck = false;
        };

    settings = {
      fsmonitor.backend = "none";
      fsmonitor.watchman.register-snapshot-trigger = false;

      user.name = config.programs.git.settings.user.name;
      user.email = config.ole.jj.email;

      ui.default-command = [
        "log"
        "-r"
        "current_work()"
      ];
      ui.diff-formatter = [
        "difft"
        "--color=always"
        "$left"
        "$right"
      ];
      ui.diff-editor = ":builtin";
      ui.graph.style = "curved";

      git.protect-local-branches = true;

      signing =
        lib.optionalAttrs (lib.isString config.ole.jj.sshSignKey) {
          backend = "ssh";
          key = config.ole.jj.sshSignKey;
        }
        // lib.optionalAttrs (lib.isString config.ole.jj.gpgSignKey) {
          backend = "gpg";
          key = config.ole.jj.gpgSignKey;
        }
        // {
          behavior = "own";
        };

      templates = {
        log = "change_compact";
        log_node = ''
          coalesce(
            if(!self, "🮀"),
            if(current_working_copy, "@"),
            if(root, "┴"),
            if(immutable, "●", "○"),
          )
        '';

        draft_commit_description = ''
          concat(
            coalesce(description, default_commit_description, "\n"),
            surround(
              "\nJJ: This commit contains the following changes:\n", "",
              indent("JJ:     ", diff.stat(72)),
            ),
            "\nJJ: ignore-rest\n",
            diff.git(),
          )
        '';
      };

      template-aliases = {
        "format_short_id(id)" = "id.shortest()";

        "format_short_stat(stat)" = ''
          concat(
            label("diff added", "+" ++ stat.total_added()),
            label("diff removed", "-" ++ stat.total_removed()),
          )
        '';

        change_compact = ''
          if(root,
            format_root_commit(self),
            label(if(current_working_copy, "working_copy"),
              concat(
                separate(" ",
                  format_short_change_id_with_change_offset(self),
                  format_short_commit_id(commit_id),
                  if(empty, label("empty", "(empty)")),
                  if(conflict, label("conflict", "conflict")),
                  bookmarks,
                  tags,
                  working_copies,
                  format_short_signature(author),
                  format_short_stat(self.diff().stat()),
                ) ++ "\n",
                separate(" ",
                  if(description,
                    description.first_line(),
                    label(if(empty, "empty"), description_placeholder),
                  ),
                ) ++ "\n",
              ),
            )
          )
        '';

        change_comfortable = ''change_compact ++ "\n"'';
      };

      aliases = {
        ls = [
          "log"
          "-r"
          "summary()"
        ];
        bo = [ "bookmark" ];
        r = [
          "rebase"
          "--skip-emptied"
          "-d"
          "trunk()"
        ];
        ra = [
          "rebase"
          "--skip-emptied"
          "-d"
          "trunk()"
          "-b"
          "summary()"
        ];
        sq = [
          "squash"
          "--use-destination-message"
          "--keep-emptied"
        ];
        si = [
          "sq"
          "-i"
        ];
        f = [
          "git"
          "fetch"
        ];
        p = [
          "git"
          "push"
          "-r"
          "current_work() ~ conflicts()"
        ];
        pa = [
          "git"
          "push"
          "--all"
        ];
        pc = [
          "git"
          "push"
          "-c"
          "current_work() ~ empty() ~ conflicts() ~ description(regex:'^wip:')"
        ];
        pca = [
          "git"
          "push"
          "-c"
          "summary() ~ empty() ~ conflicts() ~ description(regex:'^wip:')"
        ];
        co = [
          "util"
          "exec"
          "--"
          "bash"
          "-c"
          ''
            jj new "'$0'@origin"
          ''
        ];
        mb = [
          "bookmark"
          "move"
          "-f"
          "prev_branch(@)"
          "-t"
          "heads(..@ ~ empty() ~ description(exact:''))"
        ];
      };

      revsets = {
        log = "..@";
      };

      revset-aliases = {
        "top" = "heads(@-:: ~ @)";
        "on_top_trunk(x)" = "trunk()..x";
        "current_work()" = "roots(on_top_trunk(@))::";
        "my_branch_work()" = "(on_top_trunk(bookmarks() ~ trunk()))::";
        "my_anon_work()" = "on_top_trunk(latest(..trunk(), 500):: & mine() & mutable())";
        "summary()" = "my_branch_work() | my_anon_work() | current_work()";
        "my_heads()" = "heads(summary())";
        "next_branch(x)" = "heads(x:: & bookmarks())";
        "prev_branch(x)" = "heads(::x & bookmarks())";
        "branch_contents(x)" = "prev_branch(x-)..next_branch(x)";
      };
    };
  };

  config.home.shellAliases = {
    J = "jj";
    j = "jj";
  };

  config.programs.zsh.initContent = ''
    source <(COMPLETE=zsh ${config.programs.jujutsu.package}/bin/jj)
  '';
}
