{pkgs, ...}: {
  home = {
    packages = [pkgs.sccache];

    file.".cargo/config.toml".text = ''
      [alias]
      b = "build"
      bat = ["build", "--all-targets"]
      t = "test"

      [build]
      rustc-wrapper = "${pkgs.sccache}/bin/sccache"
    '';
  };
}
