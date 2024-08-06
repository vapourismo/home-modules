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
      tree
      vim
      watchman
      wget
      fd
      tree-sitter
    ]
    ++ lib.optional stdenv.isDarwin pinentry_mac;
}
