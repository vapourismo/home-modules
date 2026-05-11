return {
    "nvim-lualine/lualine.nvim",
    opts = function()
        local noice = require("noice")

        return {
            options = {
                icons_enabled = false,
                component_separators = {
                    left = "",
                    right = ""
                },
                section_separators = {
                    left = "",
                    right = "",
                },
            },
            sections = {
                lualine_a = { "mode" },
                lualine_b = {
                    function()
                        local cwd = vim.fn.getcwd(-1, 0)
                        return vim.fn.fnamemodify(cwd, ":~")
                    end,
                    {
                        "diagnostics",
                        sources = { "nvim_workspace_diagnostic" },
                        icons_enabled = true,
                    },
                    "diff",
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
        }
    end,
}
