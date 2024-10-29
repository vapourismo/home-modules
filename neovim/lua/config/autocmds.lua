-- Remove line numbers and sign column in terminal buffers
vim.api.nvim_create_autocmd({ "TermOpen" }, {
	callback = function()
		vim.cmd.setlocal("nonumber")
		vim.cmd.setlocal("norelativenumber")
		vim.cmd.setlocal("signcolumn=no")
	end,
})

-- Format on save
vim.api.nvim_create_autocmd({ "BufWritePre" }, {
	callback = function()
		vim.lsp.buf.format()
	end,
})

-- Enable inlay hints for LSP
vim.api.nvim_create_autocmd({ "LspAttach" }, {
	callback = function()
		vim.lsp.inlay_hint.enable(true)
	end,
})

-- Automaticaly equalise window sizes when the terminal is resized
vim.api.nvim_create_autocmd({ "VimResized" }, {
	callback = function()
		vim.cmd.wincmd("=")
	end,
})

-- Automatically close the buffer when it gets hidden for Git and Jujutsu message buffers
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
	end,
})

-- Remote control server
vim.api.nvim_create_autocmd({ "UIEnter" }, {
	callback = function()
		vim.fn.serverstart("/tmp/nvimsocket")
	end,
})

vim.api.nvim_create_autocmd({ "VimLeave" }, {
	callback = function()
		vim.fn.serverstop("/tmp/nvimsocket")
	end,
})
