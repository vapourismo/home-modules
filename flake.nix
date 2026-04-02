{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    omz-nix-shell-plugin = {
      url = "github:chisui/zsh-nix-shell";
      flake = false;
    };
    omz-autocomplete-plugin = {
      url = "github:marlonrichert/zsh-autocomplete";
      flake = false;
    };
    jujutsu.url = "github:jj-vcs/jj/v0.40.0";
    mergiraf.url = "git+https://codeberg.org/mergiraf/mergiraf.git?ref=refs/tags/v0.16.3";
    flake-utils.url = "github:numtide/flake-utils";
    zed.url = "github:vapourismo/zed";
  };

  outputs =
    {
      self,
      nixpkgs,
      home-manager,
      flake-utils,
      ...
    }@inputs:
    {
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
        mergiraf = import ./mergiraf.nix;
        jrnl = import ./jrnl.nix;
        zed = import ./zed.nix;
        radicle = import ./radicle.nix;
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
            self.homeModules.mergiraf
            self.homeModules.radicle
            self.homeModules.zed

            (
              { config, ... }:
              {
                home = {
                  username = "ole";
                  stateVersion = "25.05";
                };

                ole = {
                  slot1 = "${config.programs.neovide.package}/Applications/Neovide.app";
                  slot2 = "${config.programs.zed-editor.package}/Applications/Zed Nightly.app";
                  slot3 = "/Applications/Brave Browser.app";
                  jj.sshSignKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO7vlc902QXTseSF7NsFy3CouUnWFQWDFy1EvS0CRD5q";
                };
              }
            )
          ];

          extraSpecialArgs = { inherit inputs; };
        };

        dev1 = home-manager.lib.homeManagerConfiguration {
          pkgs = nixpkgs.legacyPackages."aarch64-linux";

          modules = [
            self.homeModules.cargo
            self.homeModules.common-packages
            self.homeModules.git
            self.homeModules.home
            self.homeModules.jujutsu
            self.homeModules.neovim
            self.homeModules.nixpkgs
            self.homeModules.terminal
            self.homeModules.mergiraf

            {
              home = {
                username = "ole";
                stateVersion = "25.05";
              };

              ole = {
                sccache = true;
              };
            }
          ];

          extraSpecialArgs = { inherit inputs; };
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
            self.homeModules.mergiraf
            self.homeModules.jrnl
            self.homeModules.zed

            (
              { config, ... }:
              {
                home = {
                  username = "ole";
                  stateVersion = "25.05";
                };

                ole = {
                  slot1 = "${config.programs.neovide.package}/Applications/Neovide.app";
                  slot2 = "${config.programs.zed-editor.package}/Applications/Zed Nightly.app";
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
            )
          ];

          extraSpecialArgs = { inherit inputs; };
        };
      };
    }
    // flake-utils.lib.eachDefaultSystem (system: {
      formatter = nixpkgs.legacyPackages.${system}.nixfmt-tree;
    });
}
