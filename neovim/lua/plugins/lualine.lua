local function file_name()
	return vim.fn.expand("%:.")
end

return {
	"nvim-lualine/lualine.nvim",
	dependencies = { "arkav/lualine-lsp-progress" },
	opts = {
		options = {
			icons_enabled = false,
			component_separators = {
				left = "",
				right = ""
			},
			section_separators = {
				left = "",
				right = ""
			},
		},
		sections = {
			lualine_a = { "mode" },
			lualine_b = { "diagnostics" },
			lualine_c = { "lsp_progress" },
			lualine_x = {},
			lualine_y = { file_name },
			lualine_z = { "location" }
		},
		inactive_sections = {
			lualine_a = {},
			lualine_b = {},
			lualine_c = {},
			lualine_x = {},
			lualine_y = { file_name },
			lualine_z = { "location" }
		},
	}
}
