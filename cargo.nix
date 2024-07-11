{
  pkgs,
  lib,
  config,
  ...
}: {
  options.ole = {
    sccache = lib.mkOption {
      type = lib.types.bool;
      default = true;
    };
  };

  config.home = {
    packages = lib.optional config.ole.sccache pkgs.sccache;

    file.".cargo/config.toml".text =
      ''
        [alias]
        b = "build"
        bat = ["build", "--all-targets"]
        t = "test"
      ''
      + lib.optionalString config.ole.sccache ''
        [build]
        rustc-wrapper = "${pkgs.sccache}/bin/sccache"
      '';
  };
}
