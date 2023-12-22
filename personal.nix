{
  config,
  pkgs,
  ...
}: {
  imports = [
    ./helix.nix
    ./skhd.nix
    ./wezterm.nix
    ./git.nix
    ./nixpkgs.nix
    ./zsh.nix
    ./direnv.nix
  ];

  ole.browserApp = "/Applications/Arc.app";

  home = {
    username = "ole";
    homeDirectory = "/Users/${config.home.username}";
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
      nix
      taskwarrior
      taskwarrior-tui
    ];
  };
}
