return {
    "saghen/blink.pairs",
    version = "*",
    build = 'nix run .#build-plugin',
    opts = {
        highlights = {
            enabled = false,
        }
    },
}
