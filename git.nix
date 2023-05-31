{...}: {
  config.programs.git = {
    enable = true;
    userName = "Ole Krüger";
    aliases = {
      s = "status -s";
      c = "commit -v";
      ca = "commit -av";
      d = "diff";
      a = "add -v";
      avu = "add -vu";
      co = "checkout";
      pfwl = "push --force-with-lease";
      g = "grep -n";
      rbi = "rebase -i";
      prb = "pull --rebase";
    };
    extraConfig = {
      stgit.alias = {
        rip = "refresh -i -p";
        ls = "series";
        s = "status";
      };
      diff.algorithm = "patience";
      core.editor = "/Users/ole/.nix-profile/bin/hx";
    };
  };
}
