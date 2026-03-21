{
  pkgs,
  specialArgs,
  ...
}:
{
  programs.mergiraf = {
    enable = true;
    enableJujutsuIntegration = true;
    enableGitIntegration = true;
    package = specialArgs.inputs.mergiraf.packages.${pkgs.stdenv.hostPlatform.system}.mergiraf;
  };
}
