{config, ...}: {
  imports = [
    ./skhd.nix
    ./wezterm.nix
    ./git.nix
    ./nixpkgs.nix
    ./zsh.nix
    ./direnv.nix
    ./common-packages.nix
    ./darwin-defaults.nix
    ./jujutsu.nix
    ./neovim.nix
    ./cargo.nix
  ];

  ole = {
    slot2 = config.ole.slot1;
    slot3 = "/Applications/Brave Browser.app";
    slot4 = "/Applications/Todoist.app";
    jj.sshSignKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO7vlc902QXTseSF7NsFy3CouUnWFQWDFy1EvS0CRD5q";
  };

  home = {
    username = "ole";
    homeDirectory = "/Users/${config.home.username}";
    stateVersion = "23.05";
  };
}
