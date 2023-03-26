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
      wezterm = "${config.programs.wezterm.package}/Applications/WezTerm.app";
    in {
      text = ''
        cmd - 1 [
            "wezterm" ~
            * : open -a ${wezterm}
        ]

        cmd - 2 [
            "wezterm" ~
            * : open -a ${wezterm}
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
