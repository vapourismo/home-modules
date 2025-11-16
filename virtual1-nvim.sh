#!/bin/bash

exec ssh ole@192.168.64.3 -- .nix-profile/bin/zsh -i .nix-profile/bin/nvim "$@"
