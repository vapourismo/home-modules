{pkgs, ...}: {
  home.packages = [
    # Bash on MacOS is too old for Nix shells to work properly
    pkgs.bash
  ];

  programs.direnv = {
    enable = true;
    enableZshIntegration = true;
  };
}
