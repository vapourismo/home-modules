{...}: {
  programs.zsh = {
    enable = true;

    oh-my-zsh = {
      enable = true;

      custom = "$HOME/.oh-my-zsh-custom";
      theme = "ole";
      plugins = ["git" "nix-shell"];

      extraConfig = ''
        # env vars
        export LESS=-FRX
        export EDITOR=hx
        export MAKEFLAGS=-j12

        # aliases
        alias ls='ls --color=auto'
        alias grep='grep --color=auto'
        alias g=git
        alias s=stg

        # direnv
        eval "$(direnv hook zsh)"
      '';
    };
  };
}
