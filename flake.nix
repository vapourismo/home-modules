{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    omz-nix-shell-plugin = {
      url = "github:chisui/zsh-nix-shell";
      flake = false;
    };
    jujutsu.url = "github:vapourismo/jj";
  };

  outputs = {
    self,
    nixpkgs,
    home-manager,
    ...
  } @ inputs: {
    homeModules = {
      cargo = import ./cargo.nix;
      common-packages = import ./common-packages.nix;
      darwin-defaults = import ./darwin-defaults.nix;
      git = import ./git.nix;
      home = import ./home.nix;
      jujutsu = import ./jujutsu.nix;
      neovim = import ./neovim.nix;
      nixpkgs = import ./nixpkgs.nix;
      skhd = import ./skhd.nix;
      terminal = import ./terminal.nix;
    };

    homeConfigurations = {
      personal = home-manager.lib.homeManagerConfiguration {
        pkgs = nixpkgs.legacyPackages."aarch64-darwin";

        modules = [
          self.homeModules.cargo
          self.homeModules.common-packages
          self.homeModules.darwin-defaults
          self.homeModules.git
          self.homeModules.home
          self.homeModules.jujutsu
          self.homeModules.neovim
          self.homeModules.nixpkgs
          self.homeModules.skhd
          self.homeModules.terminal

          {
            home = {
              username = "ole";
              stateVersion = "23.05";
            };

            ole = {
              slot3 = "/Applications/Brave Browser.app";
              jj.sshSignKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO7vlc902QXTseSF7NsFy3CouUnWFQWDFy1EvS0CRD5q";
            };
          }
        ];

        extraSpecialArgs = {
          inherit inputs;
        };
      };

      work = home-manager.lib.homeManagerConfiguration {
        pkgs = nixpkgs.legacyPackages."aarch64-darwin";

        modules = [
          self.homeModules.cargo
          self.homeModules.common-packages
          self.homeModules.darwin-defaults
          self.homeModules.git
          self.homeModules.home
          self.homeModules.jujutsu
          self.homeModules.neovim
          self.homeModules.nixpkgs
          self.homeModules.skhd
          self.homeModules.terminal

          {
            home = {
              username = "ole";
              stateVersion = "23.05";
            };

            ole = {
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
        ];

        extraSpecialArgs = {
          inherit inputs;
        };
      };
    };
  };
}
