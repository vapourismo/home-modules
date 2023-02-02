{...}: {
  programs.git = {
    enable = true;
    userName = "Ole Krüger";
    userEmail = "ole@vprsm.de";
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
        rip = "stg refresh -i -p";
        ls = "stg series";
        s = "stg status";
      };
      diff.algorithm = "patience";
      core.editor = "/Users/ole/.nix-profile/bin/hx";
    };
  };
}
