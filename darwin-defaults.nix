{...}: {
  targets.darwin.defaults.NSGlobalDomain = {
    # Delay until keys are repeated
    InitialKeyRepeat = 10;

    # Rate at which keys are repeated
    KeyRepeat = 1;
  };
}
