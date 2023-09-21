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
      f = "fetch";
    };
    extraConfig = {
      stgit.alias = {
        rip = "refresh -i -p";
        r = "refresh";
        remaster = "!git fetch origin && stg rebase -m origin/master && stg clean";
        ls = "series -r";
        s = "!stg status";
      };
      diff.algorithm = "patience";
      core.editor = "/Users/ole/.nix-profile/bin/hx";
    };
  };
}
