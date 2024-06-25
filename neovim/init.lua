-- Directories
local data_dir = vim.fn.stdpath("data")

-- Config
vim.opt.termguicolors = true
vim.opt.number = true
vim.opt.compatible = false
vim.opt.tabstop = 4
vim.opt.guicursor = "n-sm-v-ve:block,c-ci-i:ver25,cr-r-o:hor20"
vim.opt.colorcolumn = "100,120"
vim.opt.foldmethod = "expr"
vim.opt.foldexpr = "nvim_treesitter#foldexpr()"
vim.opt.foldenable = false

-- Disable netrw
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- Configure diagnostics
vim.diagnostic.config({
	virtual_text = false
})

-- Lazy plugin manager
vim.opt.rtp:prepend(data_dir .. "/lazy/lazy.nvim")
require("lazy").setup({
	{
		"catppuccin/nvim",
		name = "catppuccin",
		priority = 1000,
		lazy = false,
		config = function()
			local catppuccin = require("catppuccin")
			catppuccin.setup({
				integrations = {
					native_lsp = {
						enabled = true,
						inlay_hints = {
							background = false,
						},
					},
				},
				no_italic = true,
				styles = {
					comments = { "bold" }
				}
			})

			vim.cmd.colorscheme("catppuccin-mocha")
		end,
	},

	{
		"nvim-telescope/telescope.nvim",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"sharkdp/fd",
			"BurntSushi/ripgrep",
		},
		config = function()
			local actions = require("telescope.actions")
			require("telescope").setup({
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

			local builtin = require("telescope.builtin")

			vim.keymap.set("n", "<Space>f", builtin.find_files)
			vim.keymap.set("n", "<Space>/", builtin.live_grep)
			vim.keymap.set("n", "<Space>b", builtin.buffers)
			vim.keymap.set("n", "<Space>s", builtin.lsp_document_symbols)
			vim.keymap.set("n", "<Space>S", builtin.lsp_dynamic_workspace_symbols)
			vim.keymap.set("n", "<Space>D", builtin.diagnostics)
			vim.keymap.set("n", "gr", builtin.lsp_references)
			vim.keymap.set("n", "gd", builtin.lsp_definitions)
			vim.keymap.set("n", "gt", builtin.lsp_type_definitions)
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
		"folke/flash.nvim",
		lazy = false,
		config = function()
			local flash = require("flash")

			vim.keymap.set("", "<Space>j", function() flash.jump() end)
		end,
	},

	{
		"neovim/nvim-lspconfig",
		config = function()
			local lspconfig = require("lspconfig")

			lspconfig.rust_analyzer.setup({
				inlay_hints = { enabled = true },
				settings = {
					["rust-analyzer"] = {
						check = { command = "clippy" },
						cargo = { features = "all" },
						imports = { granularity = { enforce = true } },
					}
				}
			})
			lspconfig.lua_ls.setup({})
			lspconfig.nil_ls.setup({
				settings = {
					["nil"] = {
						formatting = { command = { "alejandra" } }
					}
				}
			})
			lspconfig.taplo.setup({})
			lspconfig.ocamllsp.setup({})
			lspconfig.pylsp.setup({})
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
				preselect = cmp.PreselectMode.None,
				mapping = cmp.mapping.preset.insert({
					["<C-Space>"] = cmp.mapping.complete(),
					["<Enter>"] = cmp.mapping.confirm({
						select = false
					}),
					["<Tab>"] = cmp.mapping.select_next_item({
						behavior = cmp.SelectBehavior.Insert
					}),
					["<C-j>"] = cmp.mapping.select_next_item({
						behavior = cmp.SelectBehavior.Insert
					}),
					["<C-n>"] = cmp.mapping.select_next_item({
						behavior = cmp.SelectBehavior.Insert
					}),
					["<S-Tab>"] = cmp.mapping.select_prev_item({
						behavior = cmp.SelectBehavior.Insert
					}),
					["<C-k>"] = cmp.mapping.select_prev_item({
						behavior = cmp.SelectBehavior.Insert
					}),
					["<C-p>"] = cmp.mapping.select_prev_item({
						behavior = cmp.SelectBehavior.Insert
					}),
				}),
				sources = cmp.config.sources(
					{
						{ name = "nvim_lsp" },
					},
					{
						{ name = "buffer" },
					}
				),
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
		dependencies = { "arkav/lualine-lsp-progress" },
		config = function()
			local lualine = require("lualine")

			local function file_name()
				return vim.fn.expand("%:.")
			end

			lualine.setup({
				options = {
					icons_enabled = false
				},
				sections = {
					lualine_a = { "mode" },
					lualine_b = { "branch", "diff" },
					lualine_c = { "lsp_progress" },
					lualine_x = {},
					lualine_y = { "diagnostics" },
					lualine_z = { file_name, "location" }
				},
				inactive_sections = {
					lualine_a = {},
					lualine_b = {},
					lualine_c = {},
					lualine_x = {},
					lualine_y = {},
					lualine_z = { file_name, "location" }
				},
			})
		end
	},

	{
		"zbirenbaum/copilot.lua",
		cmd = "Copilot",
		event = "InsertEnter",
		config = function()
			require("copilot").setup({
				suggestion = {
					enabled = true,
					auto_trigger = true,
				},
				panel = { enabled = false },
			})
		end,
	},

	{
		"famiu/bufdelete.nvim"
	},

	{
		"aznhe21/actions-preview.nvim",
		config = function()
			local actions_preview = require("actions-preview")
			vim.keymap.set("", "<Space>a", actions_preview.code_actions)
		end,
	},
})

-- Keys
vim.keymap.set("", "<Space><Space>q", function()
	vim.cmd("mksession! ~/.nvim-last-session")
	vim.cmd("qa")
end)
vim.keymap.set("", "<Space>k", vim.lsp.buf.hover)
vim.keymap.set("", "<Space>r", vim.lsp.buf.rename)
vim.keymap.set("", "<Space>y", '"+y')
vim.keymap.set("", "<Space>p", '"+p')
vim.keymap.set("", "<Space>P", '"+P')
vim.keymap.set("", "y", '"+y')
vim.keymap.set("", "p", '"+p')
vim.keymap.set("", "P", '"+P')
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
vim.keymap.set("", "U", "<C-r>")
vim.keymap.set("", "gh", "0")
vim.keymap.set("", "gl", "g_")
vim.keymap.set("", "gs", "_")
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

vim.api.nvim_create_autocmd({ "LspAttach" }, {
	callback = function()
		vim.lsp.inlay_hint.enable(true)
	end
})

vim.api.nvim_create_autocmd({ "TermOpen" }, {
	callback = function()
		vim.cmd("setlocal nonumber")
	end
})

vim.api.nvim_create_autocmd({ "VimResized" }, {
	callback = function()
		vim.cmd.wincmd("=")
	end
})
