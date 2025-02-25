return {
	{
		"catppuccin/nvim",
		name = "catppuccin",
		priority = 1000,
		lazy = false,
		opts = {
			integrations = {
				native_lsp = {
					enabled = true,
					inlay_hints = {
						background = false,
					},
				},
				treesitter_context = false,
			},
			no_italic = true,
			styles = {
				comments = { "bold" }
			}
		},
	},

	{
		"f-person/auto-dark-mode.nvim",
		dependencies = { "catppuccin/nvim" },
		opts = {
			update_interval = 10000,
			set_dark_mode = function()
				vim.cmd.colorscheme("catppuccin-mocha")

				vim.g.terminal_color_0 = "#000000"
				vim.g.terminal_color_1 = "#ff3333"
				vim.g.terminal_color_2 = "#b8cc52"
				vim.g.terminal_color_3 = "#e7c547"
				vim.g.terminal_color_4 = "#36a3d9"
				vim.g.terminal_color_5 = "#f07178"
				vim.g.terminal_color_6 = "#95e6cb"
				vim.g.terminal_color_7 = "#ffffff"
				vim.g.terminal_color_8 = "#323232"
				vim.g.terminal_color_9 = "#ff6565"
				vim.g.terminal_color_10 = "#eafe84"
				vim.g.terminal_color_11 = "#fff779"
				vim.g.terminal_color_12 = "#68d5ff"
				vim.g.terminal_color_13 = "#ffa3aa"
				vim.g.terminal_color_14 = "#c7fffd"
				vim.g.terminal_color_15 = "#ffffff"
			end,
			set_light_mode = function()
				vim.cmd.colorscheme("catppuccin-latte")

				vim.g.terminal_color_0 = "#5C6A72"
				vim.g.terminal_color_1 = "#F85552"
				vim.g.terminal_color_2 = "#8DA101"
				vim.g.terminal_color_3 = "#DFA000"
				vim.g.terminal_color_4 = "#3A94C5"
				vim.g.terminal_color_5 = "#DF69BA"
				vim.g.terminal_color_6 = "#35A77C"
				vim.g.terminal_color_7 = "#DFDDC8"
				vim.g.terminal_color_8 = "#2E383C"
				vim.g.terminal_color_9 = "#E67E80"
				vim.g.terminal_color_10 = "#A7C080"
				vim.g.terminal_color_11 = "#DBBC7F"
				vim.g.terminal_color_12 = "#7FBBB3"
				vim.g.terminal_color_13 = "#D699B6"
				vim.g.terminal_color_14 = "#83C092"
				vim.g.terminal_color_15 = "#D3C6AA"
			end,
		},
	},

	{
		"folke/noice.nvim",
		event = "VeryLazy",
		opts = {
			{
				lsp = {
					override = {
						["vim.lsp.util.convert_input_to_markdown_lines"] = true,
						["vim.lsp.util.stylize_markdown"] = true,
						["cmp.entry.get_documentation"] = true,
					},
				},
				presets = {
					bottom_search = true,
					command_palette = true,
					long_message_to_split = true,
					inc_rename = false,
					lsp_doc_border = false,
				},
			}
		},
		dependencies = {
			"MunifTanjim/nui.nvim",
			"rcarriga/nvim-notify",
		}
	}
}
