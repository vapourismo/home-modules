{
  config,
  lib,
  pkgs,
  ...
}:
let
  skhd = pkgs.stdenv.mkDerivation {
    pname = "skhd";
    version = "0.0.17";
    src = pkgs.fetchurl {
      url = "https://github.com/jackielii/skhd.zig/releases/download/v0.0.17/skhd-arm64-macos.tar.gz";
      sha256 = "d65bef42850e0b1a6eb34ecbe4ab06d65df4188f8b3fe2a4bcb190375d8a161b";
    };
    sourceRoot = ".";
    installPhase = ''
      mkdir -p $out/bin
      cp skhd-arm64-macos $out/bin/skhd
    '';
  };
in
{
  options.ole = {
    slot1 = lib.mkOption {
      type = lib.types.str;
      default = "${config.programs.neovide.package}/Applications/Neovide.app";
    };

    slot2 = lib.mkOption {
      type = lib.types.str;
      default = "/Applications/Obsidian.app";
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
      packages = [ skhd ];

      file.".skhdrc" = {
        text = ''
          ${lib.optionalString (lib.isString config.ole.slot1) "cmd - 1 : open -a ${lib.strings.escapeShellArg config.ole.slot1}"}

          ${lib.optionalString (lib.isString config.ole.slot2) "cmd - 2 : open -a ${lib.strings.escapeShellArg config.ole.slot2}"}

          ${lib.optionalString (lib.isString config.ole.slot3) "cmd - 3 : open -a ${lib.strings.escapeShellArg config.ole.slot3}"}

          ${lib.optionalString (lib.isString config.ole.slot4) "cmd - 4 : open -a ${lib.strings.escapeShellArg config.ole.slot4}"}

          ${lib.optionalString (lib.isString config.ole.slot5) "cmd - 5 : open -a ${lib.strings.escapeShellArg config.ole.slot5}"}

          ${lib.optionalString (lib.isString config.ole.slot6) "cmd - 6 : open -a ${lib.strings.escapeShellArg config.ole.slot6}"}
        '';

        onChange = ''
          ${pkgs.skhd}/bin/skhd --restart-service
        '';
      };
    };
  };
}
