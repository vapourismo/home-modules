return {
    {
        "zbirenbaum/copilot.lua",
        dependencies = {
            "copilotlsp-nvim/copilot-lsp",
        },
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
            nes = {
                enabled = true,
                auto_trigger = true,
                keymap = {
                    accept_and_goto = "<M-l>",
                    accept = "<M-l>",
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
        }
    },
}
