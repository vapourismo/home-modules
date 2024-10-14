{
  pkgs,
  config,
  ...
}: let
  taskwarrior3-fixed = pkgs.taskwarrior3.overrideAttrs (oldAttrs: rec {
    version = "r5c6cc3e5229676655e93264e24a146a26b980e45";
    src = pkgs.fetchFromGitHub {
      owner = "GothenburgBitFactory";
      repo = "taskwarrior";
      rev = "5c6cc3e5229676655e93264e24a146a26b980e45";
      fetchSubmodules = true;
      sha256 = "iKpOExj1xM9rU/rIcOLLKMrZrAfz7y9X2kt2CjfMOOQ=";
    };

    cargoDeps = oldAttrs.cargoDeps.overrideAttrs (_: {
      inherit src;
      outputHash = "sha256-L+hYYKXSOG4XYdexLMG3wdA7st+A9Wk9muzipSNjxrA=";
    });

    doCheck = false;
  });

  taskwarrior-tui-fixed = pkgs.taskwarrior-tui.overrideAttrs (oldAttrs: rec {
    version = "r115fe6242f18752a326fab4d155437d6f37db9aa";
    src = pkgs.fetchFromGitHub {
      owner = "vapourismo";
      repo = "taskwarrior-tui";
      rev = "115fe6242f18752a326fab4d155437d6f37db9aa";
      sha256 = "ZWJANDVwLnT5woQAna+tm4WR1wRejqN+L9xkHxHgBGE=";
    };

    cargoDeps = oldAttrs.cargoDeps.overrideAttrs (_: {
      inherit src;
      outputHash = "sha256-afRFYyOaFZBbOZp7KZXIRlYhdc7J0bFEdOdYkw0gPlY=";
    });
  });
in {
  programs.taskwarrior = {
    enable = true;
    package = taskwarrior3-fixed;
    dataLocation = "${config.home.homeDirectory}/.task";
    colorTheme = "dark-256";
    config = {
      # uda.taskwarrior-tui.selection.indicator="✎";
      # uda.taskwarrior-tui.mark.indicator="■";
      # uda.taskwarrior-tui.unmark.indicator="□";
      # uda.taskwarrior-tui.mark-selection.indicator="▦";
      # uda.taskwarrior-tui.unmark-selection.indicator="▣";
    };
  };

  home.packages = [
    taskwarrior-tui-fixed
  ];
}
