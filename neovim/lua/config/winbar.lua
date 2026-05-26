local function buffer_path(buf, active)
    local hl_body = active and "WinBarNameActive" or "WinBarName"

    local path = vim.api.nvim_buf_get_name(buf)

    if type(path) == "string" and path ~= "" then
        path = vim.fn.fnamemodify(path, ":~:.")
    else
        path = "[No Name]"
    end

    return string.format(
        "%%#%s# %s %%*",
        hl_body,
        path
    )
end

local function lsp_diagnostics(buf)
    local lsp_diags = vim.diagnostic.get(buf)

    local errors = 0
    local warnings = 0
    local infos = 0
    local hints = 0

    for _, diag in ipairs(lsp_diags) do
        if diag.severity == vim.diagnostic.severity.ERROR then
            errors = errors + 1
        elseif diag.severity == vim.diagnostic.severity.WARN then
            warnings = warnings + 1
        elseif diag.severity == vim.diagnostic.severity.INFO then
            infos = infos + 1
        elseif diag.severity == vim.diagnostic.severity.HINT then
            hints = hints + 1
        end
    end

    local diag_entries = {}

    if errors > 0 then
        table.insert(diag_entries, string.format("%%#DiagnosticSignError#󰅚 %d%%*", errors))
    end

    if warnings > 0 then
        table.insert(diag_entries, string.format("%%#DiagnosticSignWarn#󰀪 %d%%*", warnings))
    end

    if infos > 0 then
        table.insert(diag_entries, string.format("%%#DiagnosticSignInfo#󰋽 %d%%*", infos))
    end

    if hints > 0 then
        table.insert(diag_entries, string.format("%%#DiagnosticSignHint#󰌶 %d%%*", hints))
    end

    return table.concat(diag_entries, " ")
end

function OleWinbarLine()
    local win = vim.g.statusline_winid
    local buf = vim.api.nvim_win_get_buf(win)
    local buftype = vim.api.nvim_get_option_value("buftype", { buf = buf })

    if buftype == "nofile" then
        return string.format("  Window %d", win)
    end

    local active = vim.api.nvim_get_current_win() == win

    local file_comp = buffer_path(buf, active)
    local diag_comp = lsp_diagnostics(buf)

    return file_comp .. "%=" .. diag_comp
end

local function fix_window(win, buf)
    local buftype = vim.api.nvim_get_option_value("buftype", { buf = buf })

    if buftype ~= "" then
        return
    end

    vim.wo[win].winbar = "%!v:lua.OleWinbarLine()"
end

vim.api.nvim_create_autocmd(
    {
        "TermOpen",
        "BufEnter",
        "BufWinEnter",
        "BufWritePost",
        "FileType",
        "LspAttach",
    },
    {
        callback = function(args)
            for _, win in ipairs(vim.fn.win_findbuf(args.buf)) do
                fix_window(win, args.buf)
            end
        end
    })

vim.opt.winbar = ""

for _, win in ipairs(vim.api.nvim_list_wins()) do
    local buf = vim.api.nvim_win_get_buf(win)
    fix_window(win, buf)
end
