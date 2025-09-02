return {
	{
		"nvim-treesitter/nvim-treesitter",
		build = ":TSUpdate",
		opts = {
			indent = {
				enable = true
			},
			highlight = {
				enable = true
			},
		}
	},

	{
		"nvim-treesitter/nvim-treesitter-context",
		dependencies = { "nvim-treesitter/nvim-treesitter" },
		opts = {
			multiwindow = true
		},
		enabled = false,
	},
}
