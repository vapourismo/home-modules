-- Directories
local data_dir = vim.fn.stdpath("data")

-- Lazy plugin manager
vim.opt.rtp:prepend(data_dir .. "/lazy/lazy.nvim")
require("lazy").setup({
  { "catppuccin/nvim", name = "catppuccin", priority = 1000 }
})
