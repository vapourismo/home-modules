{
  config,
  lib,
  pkgs,
  ...
}: {
  options.ole = {
    browserApp = lib.mkOption {
      type = lib.types.str;

      default = ''/Applications/Brave\ Browser.app'';
    };

    hasSlack = lib.mkOption {
      type = lib.types.bool;
      default = false;
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

        cmd - 3 : open -a ${config.ole.browserApp}

        ${lib.optionalString config.ole.hasSlack "cmd - 4 : open -a /Applications/Slack.app"}
      '';

      onChange = ''
        ${pkgs.skhd}/bin/skhd -r
      '';
    };
  };
}
