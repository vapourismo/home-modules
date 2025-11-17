#!/bin/bash

exec ssh ole@192.168.64.2 -- .nix-profile/bin/zsh -i .nix-profile/bin/nvim "$@"
