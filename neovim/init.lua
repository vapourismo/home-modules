-- Settings
require("config.settings")

-- Key bindings
require("config.keymaps")

-- User commands
require("config.usercmds")

-- Autocmds
require("config.autocmds")

-- Lazy plugin manager
local data_dir = vim.fn.stdpath("data")
vim.opt.rtp:prepend(data_dir .. "/lazy/lazy.nvim")
require("lazy").setup("plugins")
