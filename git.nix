{ pkgs, specialArgs, ... }:
{
  config.programs.delta = {
    enable = true;
    enableGitIntegration = true;
    enableJujutsuIntegration = true;
    options = {
      features = "catppuccin-mocha";
      side-by-side = true;
    };
  };

  config.programs.git = {
    enable = true;

    includes = [
      { path = "${specialArgs.inputs.catppuccin-delta}/catppuccin.gitconfig"; }
    ];

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
          toString file;
      };
    };
  };
}
