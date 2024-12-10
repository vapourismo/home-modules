-- Helper function to map keys in normal, visual, terminal and insert mode
local function map_nvti(key, mapping)
	vim.keymap.set("", key, mapping, { remap = false })
	vim.keymap.set({ "t", "i" }, key, "<C-\\><C-N>" .. mapping, { remap = false })
end

-- Are we in Neovide?
local neovide_leader_modified = vim.g.neovide and "D" or "M"

-- Window motions
vim.keymap.set("", "w", "<C-w>")
map_nvti("<" .. neovide_leader_modified .. "-l>", "<C-w>l")
map_nvti("<" .. neovide_leader_modified .. "-j>", "<C-w>j")
map_nvti("<" .. neovide_leader_modified .. "-k>", "<C-w>k")
map_nvti("<" .. neovide_leader_modified .. "-h>", "<C-w>h")
map_nvti("<" .. neovide_leader_modified .. "-L>", "<cmd>vertical resize +1<cr>")
map_nvti("<" .. neovide_leader_modified .. "-J>", "<cmd>resize +1<cr>")
map_nvti("<" .. neovide_leader_modified .. "-K>", "<cmd>resize -1<cr>")
map_nvti("<" .. neovide_leader_modified .. "-H>", "<cmd>vertical resize -1<cr>")

-- Escape in terminal mode
vim.keymap.set("t", "<D-Esc>", "<Esc>", { remap = false })
vim.keymap.set("t", "<Esc>", "<C-\\><C-n>", { remap = false })

-- Clear highlights on Escape in normal mode
vim.keymap.set("n", "<Esc>", function()
	vim.cmd.noh()
end)

-- Convenient file saving
vim.keymap.set("", "<C-s>", "<cmd>write<cr>", { remap = false })
vim.keymap.set("i", "<C-s>", function()
	vim.cmd.write()
	vim.cmd.startinsert()
end, { remap = false })

-- Common command palette
map_nvti("<" .. neovide_leader_modified .. "-p>", ":")

-- LSP actions
vim.keymap.set("", "<Space>k", vim.lsp.buf.hover)
vim.keymap.set("", "<Space>r", vim.lsp.buf.rename)
vim.keymap.set("", "gD", vim.lsp.buf.declaration)
vim.keymap.set("", "gj", vim.diagnostic.goto_next)
vim.keymap.set("", "gk", vim.diagnostic.goto_prev)

-- Clipboards
vim.keymap.set("", "<Space>y", '"+y')
vim.keymap.set("", "<Space>p", '"+p')
vim.keymap.set("", "<Space>P", '"+P')
vim.keymap.set("", "<D-c>", '"+y', { remap = false })
vim.keymap.set("", "<D-v>", '"+P', { remap = false })
vim.keymap.set({ "t", "i" }, "<D-v>", '<C-\\><C-N>"+pi', { remap = false })
vim.keymap.set("v", "p", "P", { remap = false })
vim.keymap.set("", "x", '"_x', { remap = false })

-- Fix annoying visual mode exit
vim.keymap.set("v", "v", function() end)

-- Cursor movements
vim.keymap.set("", "<C-l>", "e")
vim.keymap.set("", "<C-h>", "b")
vim.keymap.set("", "<C-j>", "}")
vim.keymap.set("", "<C-k>", "{")
vim.keymap.set("", "gh", "0")
vim.keymap.set("", "gl", "g_")
vim.keymap.set("", "gs", "_")

-- Indentation
vim.keymap.set("v", "<Tab>", ">gv")
vim.keymap.set("v", "<S-Tab>", "<gv")

-- Fix change selection
vim.keymap.set("", "c", "s")
vim.keymap.set("", "C", "S")

-- Redo
vim.keymap.set("", "U", "<C-r>")

-- Buffer selection
vim.keymap.set("", "bj", "<cmd>bprev<cr>")
vim.keymap.set("", "bk", "<cmd>bnext<cr>")
vim.keymap.set("", "bq", "<cmd>Bdelete<cr>")
vim.keymap.set("", "bn", "<cmd>enew<cr>")

-- Terminal creation
vim.keymap.set("", "bt", "<cmd>terminal<cr>")

-- Tab selection
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

if vim.g.neovide then
	map_nvti("<M-l>", "<cmd>tabnext<cr>")
	map_nvti("<M-h>", "<cmd>tabprevious<cr>")
end

-- JJ helper in Terminal mode
vim.keymap.set("t", "<M-j><M-j>", "<C-\\><C-O><cmd>PickJJ<cr>")

-- Navigate quickfix list
vim.keymap.set("", "<Space>.", "<cmd>cnext<cr>zz")
vim.keymap.set("", "<Space>,", "<cmd>cprevious<cr>zz")
