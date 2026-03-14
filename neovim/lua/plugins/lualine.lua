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
                theme = "catppuccin-nvim",
            },
            sections = {
                lualine_a = { "mode" },
                lualine_b = {},
                lualine_c = {},
                lualine_x = {},
                lualine_y = { { "diagnostics", sources = { "nvim_workspace_diagnostic" } } },
                lualine_z = { { "location", fmt = vim.trim } }
            },
            inactive_sections = {
                lualine_a = {},
                lualine_b = {},
                lualine_c = {},
                lualine_x = {},
                lualine_y = {},
                lualine_z = { { "location", fmt = vim.trim } }
            },
        }
    end,
}
