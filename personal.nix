{config, ...}: {
  imports = [
    ./helix.nix
    ./skhd.nix
  ];

  home = {
    username = "ole";
    homeDirectory = "/Users/${config.home.username}";
    stateVersion = "23.05";
  };
}
