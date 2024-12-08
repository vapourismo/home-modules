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
			cwd_change_handling = true,
			lsp_stop_on_restore = true,
			pre_save_cmds = { "ScopeSaveState" },
			post_restore_cmds = { "ScopeLoadState" },
		}
	}
}
