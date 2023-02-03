{config, ...}: {
  imports = [
    ./helix.nix
    ./skhd.nix
    ./wezterm.nix
    ./git.nix
    ./nixpkgs.nix
  ];

  home = {
    username = "ole";
    homeDirectory = "/Users/${config.home.username}";
    stateVersion = "23.05";
  };

  ole = {
    terminalFont = "Iosevka SS02";
    browserApp = ''/Applications/Google\ Chrome.app'';
    hasSlack = true;
    editor.rulers = [80 100];
  };
}
