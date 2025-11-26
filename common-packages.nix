{ pkgs, ... }:
with pkgs;
{
  home.packages = [
    nixfmt-rfc-style
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
    gnumake
    fzf
    stdenv.cc
  ]
  ++ lib.optionals stdenv.isDarwin [
    pinentry_mac
  ];
}
