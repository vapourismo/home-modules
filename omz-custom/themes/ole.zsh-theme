setopt prompt_subst

fg_color() {
	echo -n $((0xFF-0x$(echo -n "$1" | sha256sum | cut -c 1-2)))
}

pwd_fg_color() {
	fg_color "$(pwd)"
}

bg_color() {
	echo -n $((0x$(echo -n "$1" | sha256sum | cut -c 1-2)))
}

pwd_bg_color() {
	bg_color "$(pwd)"
}

prompt_git_branch() {
	branch=$(git rev-parse --abbrev-ref HEAD 2> /dev/null)
	[[ -n "$branch" ]] && echo -n "%K{white}%F{black} git %f%k%K{blue}%F{white} $branch %f%k "
}

prompt_nix_shell() {
	[[ -n "$IN_NIX_SHELL" ]] && echo -n "%K{white}%F{black} nix %f%k%K{yellow}%F{black} $name %f%k "
}

prompt_stg() {
	top=$(stg top 2> /dev/null)
	[[ -n "$top" ]] && echo "%K{white}%F{black} stg %f%k%K{green}%F{white} $top %f%k "
}

export PROMPT=$'\n$(prompt_nix_shell)$(prompt_git_branch)%K{white}%F{black} dir %f%k%K{magenta}%F{white} %~ %f%k \n%F{green}\u03BB%f '
