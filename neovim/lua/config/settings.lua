-- Options
vim.opt.number = true
vim.opt.compatible = false
vim.opt.guicursor = "n-sm-v-ve:block,c-ci-i:ver25,cr-r-o:hor20"
vim.opt.colorcolumn = { 100, 120 }
vim.opt.wrap = false
vim.opt.signcolumn = "yes"
vim.opt.cursorline = true
vim.opt.sessionoptions:append({ "curdir", "folds", "globals", "help", "tabpages", "terminal", "winsize", "winpos",
	"buffers" })
vim.opt.ignorecase = true
vim.opt.showtabline = 2
vim.opt.termguicolors = true
vim.opt.relativenumber = false
vim.opt.scrolloff = 10
vim.opt.tabstop = 4

vim.opt.foldmethod = "expr"
vim.opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"
vim.opt.foldtext = ""
vim.opt.foldcolumn = "0"
vim.opt.foldlevel = 99
vim.opt.foldlevelstart = 99

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
	function set_font(scale)
		local size = math.ceil(13 * scale)
		vim.opt.guifont = "IosevkaTermSS02 Nerd Font:h" .. size
	end

	set_font(1)

	vim.g.neovide_scroll_animation_length = 0.05
	vim.g.neovide_position_animation_length = 0.1
	vim.g.neovide_cursor_animation_length = 0
	vim.g.neovide_hide_mouse_when_typing = true
	vim.g.neovide_fullscreen = true
	vim.g.neovide_input_macos_option_key_is_meta = "only_left"
	vim.g.neovide_floating_shadow = false

	vim.env.EDITOR = "nvr -cc split --remote-wait"
end
