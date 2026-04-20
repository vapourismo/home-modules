return {
    "saghen/blink.pairs",
    enabled = false,
    version = "*",
    build = 'nix run .#build-plugin',
    opts = {
        highlights = {
            enabled = false,
        }
    },
}
