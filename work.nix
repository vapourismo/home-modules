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

  home = {
    username = "ole";
    homeDirectory = "/Users/${config.home.username}";
    stateVersion = "23.05";
  };

  ole = {
    slot2 = "/Applications/Brave Browser.app";
    slot3 = "/Applications/Brave Browser.app";
    slot4 = "/Applications/Slack.app";
    slot5 = "/Applications/Linear.app";
    jj = {
      gpgSignKey = "E2EF5D72A6FA996563FD44059F593788E8F596AC";
      email = "ole.kruger@trili.tech";
    };
    sccache = false;
  };
}
