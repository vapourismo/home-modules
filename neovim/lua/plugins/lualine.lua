local function file_name()
    local name = vim.fn.expand("%:.")

    if vim.startswith(name, "term://") then
        name = "term"
    end

    return name
end

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
            sections = {
                lualine_a = { "mode" },
                lualine_b = {
                    {
                        "lsp_status",
                        symbols = {
                            separator = " │ ",
                        },
                        ignore_lsp = { "copilot", "typos_lsp" },
                    }
                },
                lualine_c = {
                    {
                        "diagnostics",
                        sources = { "nvim_workspace_diagnostic" }
                    },
                },
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
                    "diff"
                },
                lualine_z = { { "location", fmt = vim.trim } }
            },
            inactive_sections = {
                lualine_a = { "mode" },
                lualine_b = {},
                lualine_c = {},
                lualine_x = {},
                lualine_y = {},
                lualine_z = { { "location", fmt = vim.trim } }
            },
        }
    end,
}
