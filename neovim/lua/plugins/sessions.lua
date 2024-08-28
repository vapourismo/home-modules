return {
	{
		"rmagatti/auto-session",
		lazy = false,
		dependencies = {
			"nvim-telescope/telescope.nvim",
			{ "stevearc/dressing.nvim", opts = {} },
		},
		opts = {
			suppressed_dirs = { "~", "~/Workspaces", "~/Downloads", "/" },
		}
	}
}
