{config, ...}: {
  home.homeDirectory = "/Users/${config.home.username}";
}
