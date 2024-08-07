-- Directories
local data_dir = vim.fn.stdpath("data")

-- Config
vim.opt.number = true
vim.opt.compatible = false
vim.opt.tabstop = 4
vim.opt.guicursor = "n-sm-v-ve:block,c-ci-i:ver25,cr-r-o:hor20"
vim.opt.colorcolumn = "100,120"
vim.opt.foldmethod = "expr"
vim.opt.foldexpr = "nvim_treesitter#foldexpr()"
vim.opt.foldenable = false
vim.opt.wrap = false
vim.opt.signcolumn = "yes"
vim.opt.cursorline = true
vim.opt.sessionoptions = "curdir,folds,globals,help,tabpages,terminal,winsize"
vim.go.ignorecase = true
vim.o.showtabline = 2

-- Terminal colors
vim.opt.termguicolors = true

-- Ayu
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

-- Everforest Light
-- vim.g.terminal_color_0 = "#5C6A72"
-- vim.g.terminal_color_1 = "#F85552"
-- vim.g.terminal_color_2 = "#8DA101"
-- vim.g.terminal_color_3 = "#DFA000"
-- vim.g.terminal_color_4 = "#3A94C5"
-- vim.g.terminal_color_5 = "#DF69BA"
-- vim.g.terminal_color_6 = "#35A77C"
-- vim.g.terminal_color_7 = "#DFDDC8"
-- vim.g.terminal_color_8 = "#2E383C"
-- vim.g.terminal_color_9 = "#E67E80"
-- vim.g.terminal_color_10 = "#A7C080"
-- vim.g.terminal_color_11 = "#DBBC7F"
-- vim.g.terminal_color_12 = "#7FBBB3"
-- vim.g.terminal_color_13 = "#D699B6"
-- vim.g.terminal_color_14 = "#83C092"
-- vim.g.terminal_color_15 = "#D3C6AA"

-- Disable netrw
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- Configure diagnostics
vim.diagnostic.config({
	virtual_text = false,
	severity_sort = true,
})

-- Helper function to map keys in normal, visual, terminal and insert mode
local function map_nvti(key, mapping)
	vim.keymap.set("", key, mapping, { remap = false })
	vim.keymap.set({ "t", "i" }, key, "<C-\\><C-N>" .. mapping, { remap = false })
end

-- Neovide
if vim.g.neovide then
	vim.o.guifont = "Iosevka Term SS02:h13"
	vim.g.neovide_scroll_animation_length = 0.05
	vim.g.neovide_position_animation_length = 0.1
	vim.g.neovide_cursor_animation_length = 0
	vim.g.neovide_hide_mouse_when_typing = true
	vim.g.neovide_fullscreen = true
	vim.g.neovide_input_macos_option_key_is_meta = "only_left"

	vim.fn.serverstart("/tmp/nvimsocket")
	vim.env.EDITOR = "nvr -cc split --remote-wait"
end

local neovide_leader_modified = vim.g.neovide and "D" or "M"

-- Window motions
map_nvti("<" .. neovide_leader_modified .. "-l>", "<C-w>l")
map_nvti("<" .. neovide_leader_modified .. "-j>", "<C-w>j")
map_nvti("<" .. neovide_leader_modified .. "-k>", "<C-w>k")
map_nvti("<" .. neovide_leader_modified .. "-h>", "<C-w>h")
map_nvti("<" .. neovide_leader_modified .. "-L>", "<cmd>vertical resize +1<cr>")
map_nvti("<" .. neovide_leader_modified .. "-J>", "<cmd>resize +1<cr>")
map_nvti("<" .. neovide_leader_modified .. "-K>", "<cmd>resize -1<cr>")
map_nvti("<" .. neovide_leader_modified .. "-H>", "<cmd>vertical resize -1<cr>")

-- Session management
local session_file = vim.g.neovide and "~/.neovide-last-session" or "~/.nvim-last-session"
vim.api.nvim_create_user_command("SaveSession", "mksession! " .. session_file, {})
vim.api.nvim_create_user_command("LoadLastSession", "source " .. session_file, {})

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

			flash.setup({
				search = {
					multi_window = false
				}
			})

			vim.keymap.set("", "<Space>j", function()
				flash.jump({ search = { mode = "fuzzy" } })
			end)
			vim.keymap.set("", "<Space>w", function()
				flash.jump({
					pattern = "",
					search = {
						mode = function(pattern)
							return ([[\<%s\w*\>]]):format(pattern), ([[\<%s]]):format(pattern)
						end,
					},
					jump = { pos = "range" },
				})
			end)
			vim.keymap.set("", "mt", function()
				flash.treesitter()
			end)
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
			lspconfig.gopls.setup({})
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

	{
		"nanozuki/tabby.nvim",
		config = function()
			local tabby = require("tabby")
			tabby.setup({
				line = function(line)
					local tabs = line.tabs().foreach(function(tab)
						local style = tab.is_current() and "TabLineSel" or "TabLine"
						local style_bg = vim.fn.synIDattr(
							vim.fn.synIDtrans(vim.fn.hlID(style)),
							"bg#"
						)

						return {
							line.sep("", style, "TabLineFill"),
							tab.number(),
							line.sep("", style, "TabLineFill"),
							hl = style,
							margin = " ",
						}
					end)
					return {
						line.spacer(),
						tabs,
						line.spacer(),
					}
				end
			})
		end
	},

	{
		"folke/noice.nvim",
		event = "VeryLazy",
		opts = {},
		dependencies = {
			"MunifTanjim/nui.nvim",
			"rcarriga/nvim-notify",
		}
	},
})

-- Terminal mode
vim.keymap.set("t", "<D-Esc>", "<Esc>", { remap = false })
vim.keymap.set("t", "<Esc>", "<C-\\><C-n>", { remap = false })

vim.api.nvim_create_autocmd({ "TermOpen" }, {
	callback = function()
		vim.cmd.setlocal("nonumber")
		vim.cmd.setlocal("signcolumn=no")
	end
})

-- Keys
vim.keymap.set("", "<Space>k", vim.lsp.buf.hover)
vim.keymap.set("", "<Space>r", vim.lsp.buf.rename)
vim.keymap.set("", "<Space>y", '"+y')
vim.keymap.set("", "<Space>p", '"+p')
vim.keymap.set("", "<Space>P", '"+P')
vim.keymap.set("", "<C-s>", "<cmd>write<cr>")
map_nvti("<" .. neovide_leader_modified .. "-p>", ":")
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
vim.keymap.set("", "w", "<C-w>")
vim.keymap.set("", "tl", "<cmd>tabnext<cr>")
vim.keymap.set("", "th", "<cmd>tabprevious<cr>")
vim.keymap.set("", "tn", "<cmd>tabnew<cr>")
vim.keymap.set("", "tq", "<cmd>tabclose<cr>")
vim.keymap.set("", "t1", "<cmd>1tabnext<cr>")
vim.keymap.set("", "t2", "<cmd>2tabnext<cr>")
vim.keymap.set("", "t3", "<cmd>3tabnext<cr>")
vim.keymap.set("", "t4", "<cmd>4tabnext<cr>")
vim.keymap.set("", "t5", "<cmd>5tabnext<cr>")
vim.keymap.set("", "t6", "<cmd>6tabnext<cr>")
vim.keymap.set("", "t7", "<cmd>7tabnext<cr>")
vim.keymap.set("", "t8", "<cmd>8tabnext<cr>")
vim.keymap.set("", "t9", "<cmd>9tabnext<cr>")
map_nvti("<M-1>", "<cmd>1tabnext<cr>")
map_nvti("<M-2>", "<cmd>2tabnext<cr>")
map_nvti("<M-3>", "<cmd>3tabnext<cr>")
map_nvti("<M-4>", "<cmd>4tabnext<cr>")
map_nvti("<M-5>", "<cmd>5tabnext<cr>")
map_nvti("<M-6>", "<cmd>6tabnext<cr>")
map_nvti("<M-7>", "<cmd>7tabnext<cr>")
map_nvti("<M-8>", "<cmd>8tabnext<cr>")
map_nvti("<M-9>", "<cmd>9tabnext<cr>")
vim.keymap.set("", "<Space><Space>q", function()
	vim.cmd("SaveSession")
	vim.cmd("qa")
end)

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

vim.api.nvim_create_autocmd({ "VimResized" }, {
	callback = function()
		vim.cmd.wincmd("=")
	end
})

vim.api.nvim_create_autocmd({ "FileType" }, {
	pattern = {
		"gitcommit",
		"gitrebase",
		"gitconfig",
		"addp-hunk-edit.diff",
		"jj",
	},
	callback = function()
		vim.cmd("set bufhidden=delete")
	end
})

vim.api.nvim_create_user_command("DirenvLoad", function(_args)
	vim.system(
		{ "direnv", "exec", "/", "direnv", "export", "json" },
		{ text = true },
		vim.schedule_wrap(function(result)
			if result.code ~= 0 then
				vim.notify("Failed to load direnv:\n" .. result.stderr, vim.log.levels.ERROR)
				return
			end

			local env = vim.fn.json_decode(result.stdout)
			for key, value in pairs(env) do
				vim.env[key] = value
			end

			vim.notify("Loaded direnv variables", vim.log.levels.INFO)
		end)
	)
end, {})
