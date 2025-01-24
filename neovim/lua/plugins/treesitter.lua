return {
	{
		"nvim-treesitter/nvim-treesitter",
		build = ":TSUpdate",
		config = function()
			require("nvim-treesitter.configs").setup({
				indent = {
					enable = true
				}
			})
		end
	},

	{
		"nvim-treesitter/nvim-treesitter-context",
		dependencies = { "nvim-treesitter/nvim-treesitter" },
		config = function()
			local context = require("treesitter-context")

			context.setup({
				multiwindow = true
			})

			-- Configure highlights
			vim.cmd("highlight TreesitterContextBottom cterm=NONE gui=NONE")
		end
	}
}
