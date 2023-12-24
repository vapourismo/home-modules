{
  config,
  lib,
  pkgs,
  ...
}: {
  options.ole = {
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

  config.home = {
    packages = [pkgs.skhd];

    file.".skhdrc" = let
      weztermApp = "${config.programs.wezterm.package}/Applications/WezTerm.app";
      weztermCli = "${config.programs.wezterm.package}/bin/wezterm";
    in {
      text = ''
        cmd - 1 [
            "wezterm" ~
            * : open -a ${weztermApp} && ${weztermCli} cli activate-tab --tab-index 0
        ]

        cmd - 2 [
            "wezterm" ~
            * : open -a ${weztermApp} && ${weztermCli} cli activate-tab --tab-index 1
        ]

        ${lib.optionalString (lib.isString config.ole.slot3) "cmd - 3 : open -a ${config.ole.slot3}"}

        ${lib.optionalString (lib.isString config.ole.slot4) "cmd - 4 : open -a ${config.ole.slot4}"}

        ${lib.optionalString (lib.isString config.ole.slot5) "cmd - 5 : open -a ${config.ole.slot5}"}

        ${lib.optionalString (lib.isString config.ole.slot6) "cmd - 6 : open -a ${config.ole.slot6}"}
      '';

      onChange = ''
        ${pkgs.skhd}/bin/skhd -r
      '';
    };
  };
}
