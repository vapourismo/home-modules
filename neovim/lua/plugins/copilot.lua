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
            local opecode_terminal_opts = {
                auto_close = true,
                win = {
                    position = "right",
                    wo = {
                        foldmethod = "manual",
                        foldtext = "foldtext()",
                    },
                    w = {
                        close_on_leave = false
                    },
                },
            }

            local snacks_terminal = require("snacks.terminal")

            vim.g.opencode_opts = {
                server = {
                    start = function()
                        snacks_terminal.open("opencode --port", opecode_terminal_opts)
                    end,
                    stop = function()
                        snacks_terminal.get("opencode --port", opecode_terminal_opts):close()
                    end,
                    toggle = function()
                        snacks_terminal.toggle("opencode --port", opecode_terminal_opts)
                    end,
                },
            }

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
