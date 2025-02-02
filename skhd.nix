{
  config,
  lib,
  pkgs,
  ...
}: {
  options.ole = {
    slot1 = lib.mkOption {
      type = lib.types.str;
      default = "${config.home.homeDirectory}/Applications/Neovide.app";
    };

    slot2 = lib.mkOption {
      type = lib.types.str;
      default = "${config.home.homeDirectory}/.nix-profile/Applications/WezTerm.app";
    };

    slot3 = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
    };

    slot4 = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
    };

    slot5 = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
    };

    slot6 = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
    };
  };

  config = {
    home = {
      packages = [pkgs.skhd];

      file.".skhdrc" = {
        text = ''
          cmd - 1 : open -a ${lib.strings.escapeShellArg config.ole.slot1}

          cmd - 2 : open -a ${lib.strings.escapeShellArg config.ole.slot2}

          ${lib.optionalString (lib.isString config.ole.slot3) "cmd - 3 : open -a ${lib.strings.escapeShellArg config.ole.slot3}"}

          ${lib.optionalString (lib.isString config.ole.slot4) "cmd - 4 : open -a ${lib.strings.escapeShellArg config.ole.slot4}"}

          ${lib.optionalString (lib.isString config.ole.slot5) "cmd - 5 : open -a ${lib.strings.escapeShellArg config.ole.slot5}"}

          ${lib.optionalString (lib.isString config.ole.slot6) "cmd - 6 : open -a ${lib.strings.escapeShellArg config.ole.slot6}"}

          cmd - j [
            "Slack" : skhd -k down
            *       ~
          ]

          cmd - k [
            "Slack" : skhd -k up
            *       ~
          ]

          cmd - h [
            "Brave Browser" : skhd -k 'ctrl + shift - tab'
            *               ~
          ]

          cmd - l [
            "Brave Browser" : skhd -k 'ctrl - tab'
            *               ~
          ]
        '';

        onChange = ''
          ${pkgs.skhd}/bin/skhd --restart-service
        '';
      };
    };
  };
}
