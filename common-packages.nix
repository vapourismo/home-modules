{ pkgs, ... }:
with pkgs;
{
  imports = [ ./user-profile.nix ];

  home.packages = [
    bash
    calc
    coreutils
    curl
    fd
    fzf
    gh
    glab
    gnumake
    gnupg
    htop
    jq
    ripgrep
    stdenv.cc
    tree
    tree-sitter
    wget
  ]
  ++ lib.optionals stdenv.isDarwin [
    pinentry_mac
  ];

  ole.profile.packages = [
    "difftastic"
    "lua-language-server"
    "nil"
    "nixd"
    "nixfmt"
    "taplo"
    "typos"
    "typos-lsp"
    "vscode-json-languageserver"
    "podman"
  ];
}
