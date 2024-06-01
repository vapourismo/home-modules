{
  config,
  lib,
  pkgs,
  specialArgs,
  ...
}: {
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
    package = specialArgs.inputs.jujutsu.packages.${pkgs.system}.default;
    settings = {
      core.fsmonitor = "watchman";

      user.name = "Ole Krüger";
      user.email = config.ole.jj.email;

      ui.default-command = ["log" "-r" "current_work()"];
      ui.diff.tool = ["difft" "--color=always" "$left" "$right"];
      ui.diff-editor = ":builtin";
      ui.graph.style = "square";

      signing =
        lib.optionalAttrs (lib.isString config.ole.jj.sshSignKey) {
          sign-all = true;
          backend = "ssh";
          key = config.ole.jj.sshSignKey;
        }
        // lib.optionalAttrs (lib.isString config.ole.jj.gpgSignKey) {
          sign-all = true;
          backend = "gpg";
          key = config.ole.jj.gpgSignKey;
        };

      templates = {
        log = "change_comfortable";
        log_node = ''
          coalesce(
            if(!self, "🮀"),
            if(current_working_copy, "@"),
            if(root, "┴"),
            if(immutable, "●", "○"),
          )
        '';
      };

      template-aliases = {
        "format_short_id(id)" = "id.shortest()";
        "format_timestamp(timestamp)" = "timestamp.ago()";

        change_compact = ''
          if(root,
            format_root_commit(self),
            label(if(current_working_copy, "working_copy"),
              concat(
                separate(" ",
                  format_short_change_id_with_hidden_and_divergent_info(self),
                  if(empty, label("empty", "(empty)")),
                  if(conflict, label("conflict", "conflict")),
                  branches,
                  tags,
                  working_copies,
                  git_head,
                  format_short_commit_id(commit_id),
                  format_timestamp(committer.timestamp()),
                  format_short_signature(author),
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
        ls = ["log" "-r" "summary()"];
        br = ["branch"];
        retrunk = ["rebase" "--skip-empty" "-d" "trunk()"];
        retrunk-all = ["rebase" "--skip-empty" "-d" "trunk()" "-b" "all:summary()"];
        sq = ["squash"];
        sqto = ["squash" "--into"];
        si = ["squash" "-i"];
        sito = ["squash" "-i" "--into"];
        wc = ["new" "all:my_heads()"];
      };

      revsets = {
        log = "..@";
      };

      revset-aliases = {
        "on_top_trunk(x)" = "trunk()..x";
        "current_work()" = "roots(on_top_trunk(@))::";
        "summary()" = "on_top_trunk(branches()):: | current_work()";
        "my_heads()" = "heads(branches())";
      };
    };
  };
}
