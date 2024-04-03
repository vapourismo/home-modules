#!/bin/sh

# Make sure failures don't slip in silently
set -e

toplevel="$(git rev-parse --show-toplevel)"
branch="$(git branch --show-current)"
master="$(git symbolic-ref --short refs/remotes/origin/HEAD)"

stg="stg -C $toplevel"
unstacked="nix run github:vapourismo/unstacked --"

patches=()

args="${@}"

for arg in $($stg series -P $args); do
  patches+=("$arg")
done

push_args=()

for patch in "${patches[@]}"; do
  ref=$($stg id $patch)
  chain_ref=$($unstacked chain --base=$master --use-merge-base --sign $ref)
  push_args+=("$chain_ref:refs/heads/ole@$patch")
done

git push --force-with-lease origin "${push_args[@]}"
