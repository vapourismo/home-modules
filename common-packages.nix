{pkgs, ...}:
with pkgs; {
  home.packages =
    [
      alejandra
      bash
      calc
      claude-code
      coreutils
      curl
      difftastic
      fd
      fzf
      gh
      glab
      gnupg
      htop
      jq
      lua-language-server
      nil
      ripgrep
      tree
      tree-sitter
      vim
      wget
    ]
    ++ lib.optional stdenv.isDarwin pinentry_mac;
}
