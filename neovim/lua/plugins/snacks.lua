return {
	"folke/snacks.nvim",
	priority = 1000,
	lazy = false,
	opts = {
		picker = {
			icons = {
				files = {
					enabled = false
				}
			}
		},
		zen = {
			toggles = {
				dim = false
			},
			show = {
				statusline = true
			}
		},
		styles = {
			zen = {
				width = 140
			},
			terminal = {
				keys = {
					term_normal = {
						"<esc>",
						function(self)
							vim.cmd("stopinsert")
						end,
						mode = "t",
						expr = true,
					},
				},
			}
		}
	},
	keys = {
		{ "<Space>z", function() Snacks.zen() end },
		{ "<C-;>",    function() Snacks.terminal(vim.o.shell, { cwd = vim.fn.getcwd(-1, 0) }) end, mode = { "n", "t", "v" } },
		{ "<C-\\>",   function() Snacks.terminal(nil, { cwd = vim.fn.getcwd(-1, 0) }) end,         mode = { "n", "t", "v" } },
	},
}
