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
			},
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
		{
			"<Space>z",
			function() Snacks.zen() end
		},
		{
			"<D-p>",
			function()
				Snacks.terminal(
					vim.o.shell,
					{
						cwd = vim.fn.getcwd(-1, 0),
						win = {
							max_width = 220,
							wo = {
								foldmethod = "manual",
								foldtext = "foldtext()",
							}
						},
					}
				)
			end,
			mode = { "n", "t", "v" }
		},
		{
			"<D-§>",
			function()
				Snacks.terminal(nil,
					{
						cwd = vim.fn.getcwd(-1, 0),
						win = {
							max_height = 30,
							wo = {
								foldmethod = "manual",
								foldtext = "foldtext()",
							}
						},
					}
				)
			end,
			mode = { "n", "t", "v" }
		},
		{
			"<Space>=",
			function() Snacks.picker.pickers() end
		},
		{
			"<Space>e",
			function() Snacks.picker.explorer() end
		},
		{
			"<Space>f",
			function() Snacks.picker.files({ layout = "vscode" }) end
		},
		{
			"<Space>/",
			function() Snacks.picker.grep() end
		},
		{
			"<Space>b",
			function() Snacks.picker.buffers() end
		},
		{
			"<Space>s",
			function() Snacks.picker.lsp_symbols() end
		},
		{
			"<Space>S",
			function() Snacks.picker.lsp_workspace_symbols() end
		},
		{
			"<Space>d",
			function()
				Snacks.picker.diagnostics_buffer({
					layout = "bottom"
				})
			end
		},
		{
			"<Space>D",
			function()
				Snacks.picker.diagnostics({
					layout = "bottom"
				})
			end
		},
		{
			"<Space>l",
			function() Snacks.picker.lines() end
		},
		{
			"gr",
			function() Snacks.picker.lsp_references() end
		},
		{
			"gd",
			function() Snacks.picker.lsp_definitions() end
		},
		{
			"gt",
			function() Snacks.picker.lsp_type_definitions() end
		},
	},
}
