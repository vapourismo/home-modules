return {
	{
		"rmagatti/auto-session",
		lazy = false,
		dependencies = {
			"nvim-telescope/telescope.nvim",
			{ "stevearc/dressing.nvim", opts = {} },
		},
		keys = {
			{ "<Space><Space>O", "<cmd>Autosession search<cr>" },
			{ "<Space><Space>s", "<cmd>SessionSave<cr>" },
			{ "<Space><Space>o", "<cmd>SessionSearch<cr>" },
		},
		opts = {
			suppressed_dirs = { "~", "~/Workspaces", "~/Downloads", "/" },
		}
	}
}
