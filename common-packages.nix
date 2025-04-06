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
      ripgrep
      tree
      vim
      watchman
      wget
      fd
      tree-sitter
      fzf
    ]
    ++ lib.optional stdenv.isDarwin pinentry_mac;
}
