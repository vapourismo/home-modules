return {
	"nvim-telescope/telescope.nvim",
	dependencies = {
		"nvim-lua/plenary.nvim",
		"sharkdp/fd",
		"BurntSushi/ripgrep",
		{ "nvim-telescope/telescope-fzf-native.nvim", build = "make" },
	},
	config = function()
		local telescope = require("telescope")
		local actions = require("telescope.actions")
		local builtin = require("telescope.builtin")

		telescope.setup({
			defaults = {
				mappings = {
					i = {
						["<C-j>"] = actions.move_selection_next,
						["<C-k>"] = actions.move_selection_previous,
					},
					n = {
						["<C-j>"] = actions.move_selection_next,
						["<C-k>"] = actions.move_selection_previous,
					}
				},
			}
		})

		telescope.load_extension("fzf")

		vim.keymap.set("n", "<Space>B", function() vim.cmd("Telescope scope buffers") end)
		vim.keymap.set("n", "<Space>s", function()
			builtin.lsp_document_symbols({
				layout_strategy = "center",
				symbol_width = 100,
			})
		end)
		vim.keymap.set("n", "<Space>S", function()
			builtin.lsp_dynamic_workspace_symbols({
				layout_strategy = "vertical",
				fname_width = 150,
				symbol_width = 100,
			})
		end)
	end
}
