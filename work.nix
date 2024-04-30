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
    ./common-packages.nix
    ./darwin-defaults.nix
  ];

  home = {
    username = "ole";
    homeDirectory = "/Users/${config.home.username}";
    stateVersion = "23.05";
  };

  ole = {
    slot3 = "/Applications/Brave Browser.app";
    slot4 = "/Applications/Slack.app";
    editor.rulers = [80 100];
  };
}
