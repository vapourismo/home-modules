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

  home = {
    username = "ole";
    homeDirectory = "/Users/${config.home.username}";
    stateVersion = "23.05";
    packages = with pkgs; [
      pinentry
      nil
      alejandra
    ];
  };

  ole = {
    slot3 = "/Applications/Arc.app";
    slot4 = "/Applications/Slack.app";
    editor.rulers = [80 100];
  };
}
