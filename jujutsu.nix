{
  pkgs,
  specialArgs,
  ...
}: {
  programs.jujutsu = {
    enable = true;
    package = specialArgs.inputs.jujutsu.packages.${pkgs.system}.default;
    settings = {
      core.fsmonitor = "watchman";

      user.name = "Ole Krüger";

      ui.default-command = ["log" "-r" "current_work()"];
      ui.diff.tool = ["difft" "--color=always" "$left" "$right"];
      ui.diff-editor = ":builtin";
      ui.graph.style = "square";

      signing.sign-all = true;
      signing.backend = "gpg";
      signing.key = "51462186765EF78CA1560BF192FC24B5225314A9";

      templates = {
        log = "change_comfortable";
      };

      template-aliases = {
        "format_short_id(id)" = "id.shortest()";
        "format_timestamp(timestamp)" = "timestamp.ago()";
        # "format_short_signature(signature)" = "coalesce(signature.name(), email_placeholder)";

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
        remaster = ["rebase" "-d" "master@origin"];
      };

      revsets = {
        log = "..@";
      };

      revset-aliases = {
        "on_top_trunk(x)" = "trunk()..x";
        "current_work()" = "roots(on_top_trunk(@))::";
        "trunk_merge_base()" = "roots(on_top_trunk(branches()))-";
        "summary()" = "on_top_trunk(branches()):: | trunk_merge_base() | trunk() | current_work()";
      };
    };
  };
}
