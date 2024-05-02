{pkgs, ...}: {
  home.packages = with pkgs; [
    pinentry
    nil
    alejandra
    ripgrep
    tree
    jq
    coreutils
    calc
    difftastic
    watchman
    wget
  ];
}
