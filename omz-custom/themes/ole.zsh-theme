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

prompt_nix_shell() {
	[[ -n "$IN_NIX_SHELL" ]] && echo -n "%K{white}%F{black} nix %f%k%K{yellow}%F{black} $name %f%k "
}


prompt_exit_code() {
	code="$?"
	[[ "$code" != "0" ]] && echo -n "%K{white}%F{black} code %f%k%K{red}%F{white} $code %f%k "
}

export PROMPT=$'\n$(prompt_exit_code)%K{white}%F{black} id %f%k%F{white}%K{#14b3a0} %n@%m %f%k $(prompt_nix_shell)%K{white}%F{black} dir %f%k%K{magenta}%F{white} %~ %f%k \n%F{green}\u03BB%f '
