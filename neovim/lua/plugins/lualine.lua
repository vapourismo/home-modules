local function file_name()
    local name = vim.fn.expand("%:.")

    if vim.startswith(name, "term://") then
        name = "term"
    end

    return name
end

return {
    "nvim-lualine/lualine.nvim",
    dependencies = { "SmiteshP/nvim-navic" },
    opts = function()
        local navic = require("nvim-navic")
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
                theme = "catppuccin",
            },
            sections = {
                lualine_a = { "mode" },
                lualine_b = { "diagnostics" },
                lualine_c = {},
                lualine_x = {},
                lualine_y = { file_name },
                lualine_z = { { "location", fmt = vim.trim } }
            },
            inactive_sections = {
                lualine_a = {},
                lualine_b = {},
                lualine_c = {},
                lualine_x = {},
                lualine_y = { file_name },
                lualine_z = { { "location", fmt = vim.trim } }
            },
            winbar = {
                lualine_c = {
                    {
                        function()
                            return navic.get_location()
                        end,
                        cond = function()
                            return navic.is_available()
                        end,
                    }
                }
            },
        }
    end,
}
