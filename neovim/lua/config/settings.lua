-- Options
vim.opt.compatible       = false
vim.opt.guicursor        = "n-sm-v-ve:block,c-ci-i:ver25,cr-r-o:hor20"
vim.opt.textwidth        = 100
vim.opt.wrap             = false
vim.opt.cursorline       = true
vim.opt.sessionoptions   = { "curdir", "folds", "blank", "winsize", "winpos" }
vim.opt.ignorecase       = true
vim.opt.showtabline      = 1
vim.opt.termguicolors    = true
vim.opt.scrolloff        = 10
vim.opt.autoread         = true
vim.opt.linespace        = 3
vim.opt.splitkeep        = "cursor"
vim.opt.laststatus       = 3
vim.opt.showmode         = false
vim.opt.fillchars        = { eob = " " }
vim.opt.splitright       = true

vim.opt.number           = true
vim.opt.signcolumn       = "yes"
vim.opt.statuscolumn     = " %l %s"
vim.opt.numberwidth      = 1
vim.opt.relativenumber   = false

vim.opt.shiftwidth       = 4
vim.opt.tabstop          = 4
vim.opt.expandtab        = true

vim.opt.foldmethod       = "manual"
vim.opt.foldtext         = ""
vim.opt.foldcolumn       = "0"
vim.opt.foldlevel        = 99
vim.opt.foldlevelstart   = 99

-- Disable netrw
vim.g.loaded_netrw       = 1
vim.g.loaded_netrwPlugin = 1

-- Allow editing right in Neovim
vim.env.EDITOR           = "nvr --remote-tab-wait"
