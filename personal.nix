{config, ...}: {
  imports = [
    ./helix.nix
    ./skhd.nix
    ./wezterm.nix
    ./git.nix
    ./nixpkgs.nix
    ./zsh.nix
    ./direnv.nix
  ];

  home = {
    username = "ole";
    homeDirectory = "/Users/${config.home.username}";
    stateVersion = "23.05";
  };
}
