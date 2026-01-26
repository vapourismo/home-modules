return {
    {
        "zbirenbaum/copilot.lua",
        cmd = "Copilot",
        event = "InsertEnter",
        opts = {
            suggestion = {
                enabled = true,
                auto_trigger = true,
                keymap = {
                    accept_word = "<M-S-L>",
                    accept_line = "<M-S-J>",
                },
            },
            panel = { enabled = false },
        }
    },

    {
        "NickvanDyke/opencode.nvim",
        dependencies = {
            "folke/snacks.nvim",
        },
        config = function()
            vim.g.opencode_opts = {
                provider = {
                    enabled = "snacks",
                    snacks = {
                        auto_close = true,
                        win = {
                            wo = {
                                foldmethod = "manual",
                                foldtext = "foldtext()",
                            },
                            w = {
                                close_on_leave = false
                            },
                        },
                    }
                }
            }

            vim.o.autoread = true

            vim.keymap.set(
                "",
                "<Space>cA",
                function() require("opencode").ask("", { submit = true }) end
            )
            vim.keymap.set(
                "",
                "<Space>ca",
                function() require("opencode").ask() end
            )
            vim.keymap.set(
                "",
                "<Space>cs",
                function() require("opencode").select() end
            )
            vim.keymap.set(
                "",
                "<Space>cc",
                function() require("opencode").toggle() end
            )
            vim.keymap.set(
                "",
                "<Space>cl",
                function() return require("opencode").operator("@this ") end,
                { expr = true }
            )
            vim.keymap.set(
                "",
                "<Space>cv",
                function() return require("opencode").operator("@this ") .. "_" end,
                { expr = true }
            )
            vim.keymap.set(
                { "n", "t" },
                "<S-D-u>",
                function() require("opencode").command("session.half.page.up") end
            )
            vim.keymap.set(
                { "n", "t" },
                "<S-D-d>",
                function() require("opencode").command("session.half.page.down") end
            )
        end,
    }
}
