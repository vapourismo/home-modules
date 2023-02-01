{pkgs, ...}: {
  home = {
    packages = [pkgs.skhd];

    file.".skhdrc" = {
      source = ./.skhdrc;
      onChange = ''
        ${pkgs.skhd}/bin/skhd -r
      '';
    };
  };
}
