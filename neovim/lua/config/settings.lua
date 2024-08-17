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

-- Disable netrw
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- Configure diagnostics
vim.diagnostic.config({
	virtual_text = false,
	severity_sort = true,
})

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
