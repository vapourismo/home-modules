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
      wget
      fd
      tree-sitter
      fzf
      lua-language-server
    ]
    ++ lib.optional stdenv.isDarwin pinentry_mac;
}
