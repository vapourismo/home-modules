{ pkgs, ... }:
with pkgs;
{
  home.packages = [
    nixfmt
    bash
    calc
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
    typos
    typos-lsp
    vim
    wget
  ]
  ++ lib.optional stdenv.isDarwin pinentry_mac;
}
