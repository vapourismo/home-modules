{ pkgs, ... }:
{
  config.programs.git = {
    enable = true;

    settings = {
      user.name = "Ole Krüger";

      alias = {
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

      diff = {
        algorithm = "patience";
        external = "difft";
      };

      core = {
        excludesFile =
          let
            file = pkgs.writeText "ignore" ''
              .direnv
              _build
              target
              .luarc.json
              .aider.*
            '';
          in
          builtins.toString file;
      };
    };
  };
}
