{pkgs, ...}: {
  home.packages = with pkgs; [
    pinentry
    nil
    alejandra
  ];
}
