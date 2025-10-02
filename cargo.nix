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
        baf = ["build", "--all-features"]
        bataf = ["build", "--all-targets", "--all-features"]
        c = "check"
        cat = ["check", "--all-targets"]
        caf = ["check", "--all-features"]
        cataf = ["check", "--all-targets", "--all-features"]
        t = ["nextest", "run"]
      ''
      + lib.optionalString config.ole.sccache ''
        [build]
        rustc-wrapper = "${pkgs.sccache}/bin/sccache"
      '';
  };
}
