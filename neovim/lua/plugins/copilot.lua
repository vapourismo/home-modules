return {
	{
		"zbirenbaum/copilot.lua",
		cmd = "Copilot",
		event = "InsertEnter",
		opts = {
			suggestion = {
				enabled = true,
				auto_trigger = true,
				keymap = {
					accept_word = "<M-S-L>",
					accept_line = "<M-S-J>",
				},
			},
			panel = { enabled = false },
		}
	},

	{
		"yetone/avante.nvim",
		build = "make",
		dependencies = {
			"echasnovski/mini.pick",
			"hrsh7th/nvim-cmp",
			"ibhagwan/fzf-lua",
			"MunifTanjim/nui.nvim",
			"nvim-lua/plenary.nvim",
			"nvim-telescope/telescope.nvim",
			"nvim-treesitter/nvim-treesitter",
			"stevearc/dressing.nvim",
			"MeanderingProgrammer/render-markdown.nvim",
		},
		event = "VeryLazy",
		lazy = false,
		opts = {
			behaviour = {
				enable_claude_text_editor_tool_mode = true
			},
			claude = {
				model = "claude-3-7-sonnet-20250219"
			},
			mappings = {
				ask = "<Space>ia",
				edit = "<Space>ie",
				files = {
					add_all_buffers = "<Space>iB",
					add_current = "<Space>ic",
				},
				focus = "<Space>if",
				refresh = "<Space>ir",
				select_history = "<Space>ih",
				select_model = "<Space>i?",
				stop = "<Space>iS",
				toggle = {
					debug = "<Space>id",
					default = "<Space>it",
					hint = "<Space>ih",
					repomap = "<Space>iR",
					suggestion = "<Space>is",
				},
			},
			provider = "claude",
		},
		tag = "v0.0.23",
	},
}
