return {
    "saghen/blink.cmp",
    dependencies = {
        "saghen/blink.lib"
    },
    build = function()
        require("blink.cmp").build():wait(60000)
    end,
    ---@module "blink.cmp"
    ---@type blink.cmp.Config
    opts = {
        enabled = function()
            return vim.bo.buftype ~= "terminal"
        end,
        keymap = {
            preset = "super-tab",
            ["<C-k>"] = { "select_prev", "fallback" },
            ["<C-j>"] = { "select_next", "fallback" },
        },
        fuzzy = {
            implementation = "rust",
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
                },
            },
        },
    },
}
