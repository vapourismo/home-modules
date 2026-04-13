{ ... }:
{
  launchd.agents = {
    upgrade-nix-profile = {
      enable = true;
      config = {
        ProcessType = "Background";
        ProgramArguments = [
          "/nix/var/nix/profiles/default/bin/nix"
          "profile"
          "upgrade"
          "--all"
        ];
        StandardErrorPath = "/tmp/upgrade-nix-profile.log.err";
        StandardOutPath = "/tmp/upgrade-nix-profile.log.out";
        StartCalendarInterval = [
          {
            Hour = 12;
            Minute = 0;
          }
        ];
      };
    };
  };
}
