{pkgs, ...}: {
  home.packages = with pkgs; [
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
    nil
    nix
    nixos-rebuild
    pinentry
    ripgrep
    stgit
    taskwarrior
    taskwarrior-tui
    tree
    vim
    watchman
    wget
  ];
}
