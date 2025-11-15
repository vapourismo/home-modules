#!/bin/bash

exec ssh ole@167.235.6.162 -- .nix-profile/bin/zsh -i .nix-profile/bin/nvim "$@"
