{pkgs, ...}:
with pkgs; {
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
      taskwarrior
      taskwarrior-tui
      tree
      vim
      watchman
      wget
    ]
    ++ lib.optional stdenv.isDarwin pinentry_mac;
}
