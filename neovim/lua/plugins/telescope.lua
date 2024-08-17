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
				}
			}
		})

		telescope.load_extension("fzf")

		vim.keymap.set("n", "<Space>f", builtin.find_files)
		vim.keymap.set("n", "<Space>/", builtin.live_grep)
		vim.keymap.set("n", "<Space>b", function() builtin.buffers({ only_cwd = true }) end)
		vim.keymap.set("n", "<Space>B", builtin.buffers)
		vim.keymap.set("n", "<Space>s", builtin.lsp_document_symbols)
		vim.keymap.set("n", "<Space>S", builtin.lsp_dynamic_workspace_symbols)
		vim.keymap.set("n", "<Space>D", builtin.diagnostics)
		vim.keymap.set("n", "gr", builtin.lsp_references)
		vim.keymap.set("n", "gd", builtin.lsp_definitions)
		vim.keymap.set("n", "gt", builtin.lsp_type_definitions)
	end
}
