return {
	"nvim-lualine/lualine.nvim",
	dependencies = { "arkav/lualine-lsp-progress" },
	config = function()
		local lualine = require("lualine")

		local function file_name()
			return vim.fn.expand("%:.")
		end

		lualine.setup({
			options = {
				icons_enabled = false
			},
			sections = {
				lualine_a = { "mode" },
				lualine_b = { "branch", "diff" },
				lualine_c = { "lsp_progress" },
				lualine_x = {},
				lualine_y = { "diagnostics" },
				lualine_z = { file_name, "location" }
			},
			inactive_sections = {
				lualine_a = {},
				lualine_b = {},
				lualine_c = {},
				lualine_x = {},
				lualine_y = {},
				lualine_z = { file_name, "location" }
			},
		})
	end
}
