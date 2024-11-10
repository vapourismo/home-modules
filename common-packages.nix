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
      fzf
      aider-chat
    ]
    ++ lib.optional stdenv.isDarwin pinentry_mac;
}
