return {
    "nvim-lualine/lualine.nvim",
    opts = function()
        local noice = require("noice")

        return {
            options = {
                icons_enabled = false,
                component_separators = {
                    left = "│",
                    right = "│"
                },
                section_separators = {
                    left = "",
                    right = ""
                },
            },
            disabled_filetypes = {
                winbar = { "snacks_terminal", "snacks_input", "terminal", "opencode" },
            },
            sections = {
                lualine_a = { "mode" },
                lualine_b = {
                    {
                        "diagnostics",
                        sources = { "nvim_workspace_diagnostic" },
                        icons_enabled = true,
                    },
                },
                lualine_c = {},
                lualine_x = {
                    {
                        noice.api.status.mode.get,
                        cond = noice.api.status.mode.has,
                        color = { fg = "#ff9e64" },
                        fmt = function(text, _)
                            if text:match("^%-%-") or text:match("%-%-$") then
                                return ""
                            end

                            return text
                        end
                    },
                },
                lualine_y = {
                    {
                        "lsp_status",
                        symbols = {
                            separator = " │ ",
                            done = "",
                        },
                        ignore_lsp = { "copilot", "typos_lsp" },
                    },
                    "filetype"
                },
                lualine_z = { { "location", fmt = vim.trim } }
            },
            inactive_sections = {
                lualine_a = { "mode" },
                lualine_b = {},
                lualine_c = {},
                lualine_x = {},
                lualine_y = {},
                lualine_z = {}
            },
            winbar = {
                lualine_a = {
                    {
                        "filename",
                        path = 1,
                        color = "TabLineNameSel",
                    },
                },
                lualine_b = {},
                lualine_c = { "%=" },
                lualine_x = {},
                lualine_y = {
                    {
                        "diagnostics",
                        icons_enabled = true,
                    },
                },
                lualine_z = {},
            },
            inactive_winbar = {
                lualine_a = {
                    {
                        "filename",
                        path = 1,
                        color = "TabLineName",
                    },
                },
                lualine_b = {},
                lualine_c = { "%=" },
                lualine_x = {},
                lualine_y = {},
                lualine_z = {},
            },
        }
    end,
}
