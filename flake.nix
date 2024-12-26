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
    nixpkgs,
    home-manager,
    ...
  } @ inputs: {
    homeConfigurations = {
      personal = home-manager.lib.homeManagerConfiguration {
        pkgs = nixpkgs.legacyPackages."aarch64-darwin";

        modules = [
          ./personal.nix
        ];

        extraSpecialArgs = {
          inherit inputs;
        };
      };

      work = home-manager.lib.homeManagerConfiguration {
        pkgs = nixpkgs.legacyPackages."aarch64-darwin";

        modules = [
          ./work.nix
        ];

        extraSpecialArgs = {
          inherit inputs;
        };
      };
    };
  };
}
