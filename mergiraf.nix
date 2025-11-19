{
  pkgs,
  specialArgs,
  ...
}:
{
  programs.mergiraf = {
    enable = true;
    package = specialArgs.inputs.mergiraf.packages.${pkgs.stdenv.hostPlatform.system}.mergiraf;
  };
}
