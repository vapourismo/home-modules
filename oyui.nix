{ ... }: {
  xdg.configFile = {
    "oyui" = {
      source = ./oyui;
      recursive = true;
    };
  };

  ole.profile.packages = [
    "nixpkgs#oyui"
  ];

  programs.jujutsu.settings = {
    ui.diff-editor = "oyui";
    ui.diff-instructions = false;
    merge-tools.oyui = {
      program = "oyui";
      edit-args = [
        "diff"
        "$left"
        "$right"
      ];
    };
  };
}
