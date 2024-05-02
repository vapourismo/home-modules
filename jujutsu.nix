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

      template-aliases = {
        "format_short_id(id)" = "id.shortest()";
        "format_timestamp(timestamp)" = "timestamp.ago()";
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
