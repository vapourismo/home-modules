{ pkgs, ... }:
with pkgs;
{
  imports = [ ./user-profile.nix ];

  home.packages = [
    bash
    calc
    coreutils
    gnumake
    gnupg
    htop
    stdenv.cc
    tree
    tree-sitter
    wget
  ]
  ++ lib.optionals stdenv.isDarwin [
    pinentry_mac
  ];

  ole.profile.packages = [
    "nixpkgs#curl"
    "nixpkgs#difftastic"
    "nixpkgs#fd"
    "nixpkgs#fzf"
    "nixpkgs#gh"
    "nixpkgs#jq"
    "nixpkgs#lua-language-server"
    "nixpkgs#nil"
    "nixpkgs#nixd"
    "nixpkgs#nixfmt"
    "nixpkgs#ripgrep"
    "nixpkgs#taplo"
    "nixpkgs#typos"
    "nixpkgs#typos-lsp"
    "nixpkgs#vscode-json-languageserver"
  ];
}
