{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    jujutsu.url = "github:jj-vcs/jj/v0.43.0";
    flake-utils.url = "github:numtide/flake-utils";
    neovide.url = "github:vapourismo/neovide";
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
        terminal = import ./terminal.nix;
        mergiraf = import ./mergiraf.nix;
        radicle = import ./radicle.nix;
        telemetry-opt-out = import ./telemetry-opt-out.nix;
        zed = import ./zed.nix;
        codex = import ./codex.nix;
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
            self.homeModules.terminal
            self.homeModules.mergiraf
            self.homeModules.radicle
            self.homeModules.telemetry-opt-out
            self.homeModules.zed
            self.homeModules.codex

            {
              home = {
                username = "ole";
                stateVersion = "26.05";
              };

              ole = {
                jj.sshSignKey = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO7vlc902QXTseSF7NsFy3CouUnWFQWDFy1EvS0CRD5q";
                sccache = false;
              };
            }
          ];

          extraSpecialArgs = { inherit inputs; };
        };
      };
    }
    // flake-utils.lib.eachDefaultSystem (system: {
      formatter = nixpkgs.legacyPackages.${system}.nixfmt-tree;
    });
}
