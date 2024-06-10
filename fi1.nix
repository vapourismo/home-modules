{
  config,
  pkgs,
  ...
}: {
  imports = [
    ./helix.nix
    ./wezterm.nix
    ./git.nix
    ./nixpkgs.nix
    ./zsh.nix
    ./direnv.nix
    ./common-packages.nix
  ];

  home = {
    username = "ole";
    homeDirectory = "/home/${config.home.username}";
    stateVersion = "23.05";

    packages = with pkgs; [
      bash
      alejandra
      nil
      nixos-rebuild
      htop
      calc
      stgit
      glab
      gh
      vim
      wget
      curl
      coreutils
      tree
      ripgrep
      gnupg
      taskwarrior
      taskwarrior-tui
    ];
  };
}
