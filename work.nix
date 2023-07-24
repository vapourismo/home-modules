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

  ole = {
    terminal.font = "Iosevka SS02";
    terminal.fontSize = 14;
    browserApp = ''/Applications/Brave\ Browser.app'';
    hasSlack = true;
    editor.rulers = [80 100];
  };
}
