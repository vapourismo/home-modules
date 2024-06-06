-- Directories
local data_dir = vim.fn.stdpath("data")

-- Config
vim.opt.termguicolors = true
vim.opt.number = true
vim.opt.compatible = false
vim.opt.tabstop = 4
vim.opt.guicursor = "n-sm-v-ve:block,c-ci-i:ver25,cr-r-o:hor20"
vim.opt.colorcolumn = "100,120"

-- Disable netrw
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- Lazy plugin manager
vim.opt.rtp:prepend(data_dir .. "/lazy/lazy.nvim")
require("lazy").setup({
	{
		"catppuccin/nvim",
		name = "catppuccin",
		priority = 1000,
		lazy = false,
		config = function()
			vim.cmd.colorscheme("catppuccin-mocha")
		end,
	},

	{
		"nvim-tree/nvim-tree.lua",
		lazy = false,
		config = function()
			require("nvim-tree").setup({})
		end,
		enabled = false
	},

	{
		"nvim-telescope/telescope.nvim",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"sharkdp/fd",
		},
		config = function()
			require("telescope").setup({})

			local builtin = require("telescope.builtin")

			vim.keymap.set("n", "<Space>f", builtin.find_files)
			vim.keymap.set("n", "<Space>/", builtin.live_grep)
			vim.keymap.set("n", "<Space>b", builtin.buffers)
			vim.keymap.set("n", "<Space>s", builtin.lsp_document_symbols)
			vim.keymap.set("n", "<Space>S", builtin.lsp_dynamic_workspace_symbols)
			vim.keymap.set("n", "<Space>D", builtin.diagnostics)
			vim.keymap.set("n", "gr", builtin.lsp_references)
		end
	},

	{
		"nvim-treesitter/nvim-treesitter",
		build = ":TSUpdate",
		config = function()
			require("nvim-treesitter.configs").setup({
				indent = {
					enable = true
				}
			})
		end
	},

	{
		"lukas-reineke/indent-blankline.nvim",
		main = "ibl",
		config = function()
			require("ibl").setup({
				indent = {
					char = "▏"
				},
				scope = {
					enabled = false
				}
			})
		end
	},

	{
		"mrcjkb/rustaceanvim",
		lazy = false,
		enabled = false,
	},

	{
		"folke/flash.nvim",
		lazy = false,
		config = function()
			local flash = require("flash")

			vim.keymap.set("", "<Space>j", function() flash.jump() end)
		end,
	},

	{
		"akinsho/bufferline.nvim",
		config = function()
			local bufferline = require("bufferline")
			bufferline.setup({
				options = {
					style_preset = bufferline.style_preset.minimal,
					show_buffer_icons = false,
					show_close_icon = false,
					show_buffer_close_icons = false,
				}
			})
		end,
		enabled = false,
	},

	{
		"neovim/nvim-lspconfig",
		config = function()
			local lspconfig = require("lspconfig")

			lspconfig.rust_analyzer.setup({})
			lspconfig.lua_ls.setup({})
			lspconfig.nil_ls.setup({
				settings = {
					["nil"] = {
						formatting = { command = { "alejandra" } }
					}
				}
			})
		end
	},

	{
		"hrsh7th/nvim-cmp",
		dependencies = {
			"hrsh7th/cmp-nvim-lsp",
			"hrsh7th/cmp-nvim-lua",
			"hrsh7th/cmp-buffer",
			"hrsh7th/cmp-path",
			"hrsh7th/cmp-cmdline",
		},
		config = function()
			local cmp = require("cmp")

			cmp.setup({
				mapping = cmp.mapping.preset.insert({
					["<C-Space>"] = cmp.mapping.complete(),
					["<Enter>"] = cmp.mapping.confirm({ select = true }),
					["<Tab>"] = cmp.mapping.confirm({ select = true }),
				}),
				sources = cmp.config.sources({
					{ name = "copilot" },
					{ name = "nvim_lsp" },
				}, {
					{ name = "buffer" },
				})
			})

			cmp.setup.cmdline({ "/", "?" }, {
				mapping = cmp.mapping.preset.cmdline(),
				sources = {
					{ name = "buffer" }
				}
			})

			cmp.setup.cmdline(":", {
				mapping = cmp.mapping.preset.cmdline(),
				sources = cmp.config.sources({
					{ name = "path" }
				}, {
					{ name = "cmdline" }
				}),
				matching = { disallow_symbol_nonprefix_matching = false }
			})
		end,
	},

	{
		"nvim-lualine/lualine.nvim",
		config = function()
			require("lualine").setup({
				options = {
					icons_enabled = false
				}
			})
		end
	},

	{
		"zbirenbaum/copilot.lua",
		cmd = "Copilot",
		event = "InsertEnter",
		config = function()
			require("copilot").setup({
				suggestion = { enabled = false },
				panel = { enabled = false },
			})
		end,
	},

	{
		"zbirenbaum/copilot-cmp",
		config = function()
			require("copilot_cmp").setup({})
		end
	},

	{
		"famiu/bufdelete.nvim"
	},
})

-- Keys
vim.keymap.set("", "<Space><Space>q", "<cmd>qa<cr>")
vim.keymap.set("", "<Space>k", vim.lsp.buf.hover)
vim.keymap.set("", "<Space>a", vim.lsp.buf.code_action)
vim.keymap.set("", "<Space>r", vim.lsp.buf.rename)
vim.keymap.set("", "<Space>c", "<cmd>:Bdelete<cr>")
vim.keymap.set("", "<Space>y", '"+y')
vim.keymap.set("", "<Space>p", '"+p')
vim.keymap.set("", "<Space>P", '"+P')
vim.keymap.set("", "<C-s>", "<cmd>write<cr>")
vim.keymap.set("t", "<Esc>", "<C-\\><C-n>")
vim.keymap.set("v", "v", function() end)
vim.keymap.set("n", "<Esc>", function()
	vim.cmd.noh()
end)
vim.keymap.set("", "<C-l>", "e")
vim.keymap.set("", "<C-h>", "b")
vim.keymap.set("", "<C-j>", "}")
vim.keymap.set("", "<C-k>", "{")
vim.keymap.set("", "c", "s")
vim.keymap.set("", "C", "S")
vim.keymap.set("", "gh", "0")
vim.keymap.set("", "gl", "$")
vim.keymap.set("", "gs", "_")
vim.keymap.set("", "gd", vim.lsp.buf.definition)
vim.keymap.set("", "gD", vim.lsp.buf.declaration)
vim.keymap.set("", "gj", vim.diagnostic.goto_next)
vim.keymap.set("", "gk", vim.diagnostic.goto_prev)
vim.keymap.set("", "bj", "<cmd>bprev<cr>")
vim.keymap.set("", "bk", "<cmd>bnext<cr>")
vim.keymap.set("", "bq", "<cmd>Bdelete<cr>")
vim.keymap.set("", "bn", "<cmd>enew<cr>")
vim.keymap.set("", "tl", "<cmd>tabnext<cr>")
vim.keymap.set("", "th", "<cmd>tabprevious<cr>")
vim.keymap.set("", "tn", "<cmd>tabnew<cr>")
vim.keymap.set("", "tq", "<cmd>tabclose<cr>")
vim.keymap.set("", "<M-l>", "<C-w>l")
vim.keymap.set("", "<M-j>", "<C-w>j")
vim.keymap.set("", "<M-k>", "<C-w>k")
vim.keymap.set("", "<M-h>", "<C-w>h")
vim.keymap.set("i", "<M-l>", "<C-o><C-w>l<Esc>")
vim.keymap.set("i", "<M-j>", "<C-o><C-w>j<Esc>")
vim.keymap.set("i", "<M-k>", "<C-o><C-w>k<Esc>")
vim.keymap.set("i", "<M-h>", "<C-o><C-w>h<Esc>")
vim.keymap.set("", "<M-L>", "<cmd>vertical resize +1<cr>")
vim.keymap.set("", "<M-J>", "<cmd>resize +1<cr>")
vim.keymap.set("", "<M-K>", "<cmd>resize -1<cr>")
vim.keymap.set("", "<M-H>", "<cmd>vertical resize -1<cr>")

-- Autocmds
vim.api.nvim_create_autocmd({ "BufWritePre" }, {
	callback = function()
		vim.lsp.buf.format()
		-- This doesn't work universally: vim.diagnostic.show()
	end
})
