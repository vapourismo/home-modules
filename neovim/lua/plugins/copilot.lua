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
                accept_word = "<M-S-L>",
                accept_line = "<M-S-J>",
                next = "<M-]>",
                prev = "<M-[>",
                dismiss = "<C-]>",
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
    },
    keys = {
        {
            "<M-l>",
            function()
                local suggestion = require("copilot.suggestion")
                local next_edit = require("copilot-lsp.nes")

                if suggestion.is_visible() then
                    suggestion.accept()
                    return
                end


                local bufnr = vim.api.nvim_get_current_buf()
                local nes_state = vim.b[bufnr].nes_state

                if nes_state then
                    if not next_edit.walk_cursor_start_edit() then
                        next_edit.apply_pending_nes()
                        next_edit.walk_cursor_end_edit()
                    end
                end
            end,
            mode = { "n", "v", "i" },
        }
    },
}
