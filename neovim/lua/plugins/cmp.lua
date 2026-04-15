return {
    "saghen/blink.cmp",
    version = "1.*",
    build = "nix run .#build-plugin",
    ---@module "blink.cmp"
    ---@type blink.cmp.Config
    opts = {
        keymap = {
            preset = "super-tab",
            ["<C-k>"] = { "select_prev", "fallback" },
            ["<C-j>"] = { "select_next", "fallback" },
        },
        fuzzy = {
            implementation = "prefer_rust",
        },
        cmdline = {
            keymap = {
                preset = "super-tab",
                ["<C-k>"] = { "select_prev", "fallback" },
                ["<C-j>"] = { "select_next", "fallback" },
            },
            completion = {
                menu = {
                    auto_show = true
                }
            },
        },
        completion = {
            accept = {
                auto_brackets = {
                    enabled = true,
                    force_allow_filetypes = { "rust" },
                },
            },
        },
    },
    opts_extend = { "sources.default" }
}
