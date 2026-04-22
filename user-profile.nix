{ lib, config, ... }:
{
  options.ole = {
    profile.packages = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = [ ];
    };
  };

  config = {
    home.activation =
      let
        installables = lib.lists.map (pkg: "nixpkgs#" + pkg) config.ole.profile.packages;

        additionCommand =
          if lib.length installables > 0 then
            "nix profile add --quiet ${lib.concatStringsSep " " installables}"
          else
            "";
      in
      {
        nixProfileAdditions = lib.hm.dag.entryAfter [ "writeBoundary" ] additionCommand;
      };

    launchd.agents = {
      upgrade-nix-profile = {
        enable = true;
        config = {
          ProcessType = "Background";
          ProgramArguments = [
            "/nix/var/nix/profiles/default/bin/nix"
            "profile"
            "upgrade"
            "--all"
            "--impure"
          ];
          StandardErrorPath = "/tmp/upgrade-nix-profile.log.err";
          StandardOutPath = "/tmp/upgrade-nix-profile.log.out";
          StartInterval = 86400;
        };
      };
    };
  };

}
