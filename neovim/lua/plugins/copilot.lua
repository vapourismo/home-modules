return {
    "zbirenbaum/copilot.lua",
    dependencies = {
        "copilotlsp-nvim/copilot-lsp",
        init = function()
            vim.g.copilot_nes_debounce = 500
        end,
    },
    cmd = "Copilot",
    event = "InsertEnter",
    opts = {
        suggestion = {
            enabled = true,
            auto_trigger = true,
            keymap = {
                accept = false,
                accept_word = false,
                accept_line = false,
            },
        },
        nes = {
            enabled = true,
            auto_trigger = true,
            keymap = {
                accept_and_goto = false,
                accept = false,
                dismiss = false,
            },
        },
        filetypes = {
            opencode = false,
            opencode_output = false,
        },
        panel = { enabled = false },
        should_attach = function(_, bufname)
            if string.match(bufname, "env") then
                return false
            end

            return true
        end,
        server_opts_overrides = {
            settings = {
                telemetry = {
                    telemetryLevel = "off",
                },
            },
        }
    },
    keys = {
        {
            "<M-l>",
            function()
                local suggestion = require("copilot.suggestion")

                if suggestion.is_visible() then
                    suggestion.accept()
                    return
                end

                local nes = require("copilot-lsp.nes")

                if not nes.walk_cursor_start_edit() then
                    if nes.apply_pending_nes() then
                        nes.walk_cursor_end_edit()
                    end
                end
            end,
            mode = { "n", "i" }
        },
        {
            "<M-S-L>",
            function()
                local suggestion = require("copilot.suggestion")
                suggestion.accept_word()
            end,
            mode = { "n", "i" }
        },
        {
            "<M-n>",
            function()
                local suggestion = require("copilot.suggestion")
                suggestion.accept_line()
            end,
            mode = { "n", "i" }
        }
    },
}
