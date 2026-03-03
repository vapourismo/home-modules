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
            local opencode = require("opencode")
            local opencode_terminal = require("opencode.terminal")
            local snacks_terminal = require("snacks.terminal")

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
                    on_win = function(win)
                        opencode_terminal.setup(win.win)
                    end,
                },
            }

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
                "<Space>cs",
                function() opencode.select() end
            )
            vim.keymap.set(
                { "n", "t", "i" },
                "<D-r>",
                function() opencode.toggle() end
            )
            vim.keymap.set(
                "n",
                "<D->>",
                function() return opencode.operator("@this") .. "_" end,
                { expr = true }
            )
            vim.keymap.set(
                "v",
                "<D->>",
                function() return opencode.operator("@this") end,
                { expr = true }
            )
            vim.keymap.set(
                { "n", "t" },
                "<S-D-u>",
                function() opencode.command("session.half.page.up") end
            )
            vim.keymap.set(
                { "n", "t" },
                "<S-D-d>",
                function() opencode.command("session.half.page.down") end
            )
        end,
    }
}
