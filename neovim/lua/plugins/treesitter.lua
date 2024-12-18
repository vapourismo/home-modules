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
			vim.cmd("hi TreesitterContextBottom cterm=NONE gui=NONE")

			-- When you switch between buffers, the context window disappears. This brings it back
			-- when you enter the buffer again.
			vim.api.nvim_create_autocmd({ "BufEnter" }, {
				callback = function()
					vim.cmd.TSContextEnable()
				end
			})
		end
	}
}
