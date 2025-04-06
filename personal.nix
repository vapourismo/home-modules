{config, ...}: {
  imports = [
    ./skhd.nix
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
    slot3 = "/Applications/Orion.app";
    slot4 = "/Applications/Superlist.app";
    jj.sshSignKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO7vlc902QXTseSF7NsFy3CouUnWFQWDFy1EvS0CRD5q";
  };

  home = {
    username = "ole";
    homeDirectory = "/Users/${config.home.username}";
    stateVersion = "23.05";
  };
}
