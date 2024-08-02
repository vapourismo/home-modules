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
    slot1 = "~/.nix-profile/Applications/WezTerm.app";
    slot3 = "/Applications/Arc.app";
    slot4 = "/Applications/Todoist.app";
    jj.sshSignKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO7vlc902QXTseSF7NsFy3CouUnWFQWDFy1EvS0CRD5q";
  };

  home = {
    username = "ole";
    homeDirectory = "/Users/${config.home.username}";
    stateVersion = "23.05";
  };
}
