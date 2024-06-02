-- Directories
local data_dir = vim.fn.stdpath("data")

-- Config
vim.opt.termguicolors = true
vim.opt.number = true

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
    dependencies = {
      "nvim-tree/nvim-web-devicons",
    },
    config = function()
      require("nvim-tree").setup({})
    end,
  },

  {
    "nvim-telescope/telescope.nvim",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "sharkdp/fd",
    },
    config = function()
      local builtin = require('telescope.builtin')

      vim.keymap.set("n", "<Space>ff", builtin.find_files)
      vim.keymap.set("n", "<Space>fg", builtin.live_grep)
      vim.keymap.set("n", "<Space>fb", builtin.buffers)
      vim.keymap.set("n", "<Space>fh", builtin.help_tags)
    end
  },

  {
    "nvim-treesitter/nvim-treesitter",
    build = ":TSUpdate"
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
})

-- Keys
vim.keymap.set("", "<Space><Space>q", "<cmd>qa<cr>")
vim.keymap.set("", "<C-s>", "<cmd>write<cr>")
vim.keymap.set("t", "<Esc>", "<C-\\><C-n>")
