{pkgs, ...}:
with pkgs; let
  taskwarrior-tui-fixed = pkgs.taskwarrior-tui.overrideAttrs (oldAttrs: rec {
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
  home.packages =
    [
      alejandra
      bash
      calc
      coreutils
      curl
      difftastic
      gh
      glab
      gnupg
      htop
      jq
      nil
      nixos-rebuild
      ripgrep
      stgit
      taskwarrior3
      taskwarrior-tui-fixed
      tree
      vim
      watchman
      wget
    ]
    ++ lib.optional stdenv.isDarwin pinentry_mac;
}
