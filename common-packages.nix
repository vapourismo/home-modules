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
    "nixpkgs#difftastic"
    "nixpkgs#lua-language-server"
    "nixpkgs#nil"
    "nixpkgs#nixd"
    "nixpkgs#nixfmt"
    "nixpkgs#taplo"
    "nixpkgs#typos"
    "nixpkgs#typos-lsp"
    "nixpkgs#vscode-json-languageserver"
    "nixpkgs#gh"
  ];
}
