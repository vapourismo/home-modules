-- Remove line numbers and sign column in terminal buffers
vim.api.nvim_create_autocmd({ "TermOpen" }, {
    callback = function()
        vim.cmd.setlocal("nonumber")
        vim.cmd.setlocal("norelativenumber")
        vim.cmd.setlocal("signcolumn=no")
    end,
})

-- Automatically equalise window sizes when the terminal is resized
vim.api.nvim_create_autocmd({ "VimResized", "WinNew", "WinResized" }, {
    callback = function()
        vim.cmd("horizontal wincmd =")
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
        "jjdescription",
    },
    callback = function()
        vim.cmd("set bufhidden=delete")
    end,
})

-- Activate svelte syntax highlighting
vim.api.nvim_create_autocmd({ "FileType" }, {
    pattern = "svelte",
    callback = function()
        vim.treesitter.start()
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

-- Active window
vim.api.nvim_create_autocmd({ "WinEnter" }, {
    callback = function()
        vim.wo.cursorline = true
    end,
})

vim.api.nvim_create_autocmd({ "WinLeave" }, {
    callback = function()
        vim.wo.cursorline = false
    end,
})

-- Close terminal windows on leave if requested
vim.api.nvim_create_autocmd({ "WinLeave" }, {
    pattern = "term://*",
    callback = function(ev)
        for _, win in pairs(Snacks.terminal.list()) do
            local close_this = win.opts and win.opts.w and win.opts.w.close_on_leave
            if win.buf == ev.buf and close_this then
                win:hide()
            end
        end
    end,
})

-- Automatically reload the environment when changing directories
vim.api.nvim_create_autocmd({ "DirChanged" }, {
    pattern = { "global", "window", "tabpage" },
    callback = function()
        vim.cmd("DirenvLoad")
    end
})

-- Reload buffer if it has changed on disk
vim.api.nvim_create_autocmd({ "FocusGained", "BufEnter" }, {
    callback = function()
        if vim.fn.mode() ~= "c" then
            vim.cmd("checktime")
        end
    end,
    pattern = "*",
})

-- Clear attention flag when entering a tabpage
vim.api.nvim_create_autocmd({ "TabEnter" }, {
    callback = function()
        vim.api.nvim_tabpage_set_var(0, "attention", false)
    end,
})
