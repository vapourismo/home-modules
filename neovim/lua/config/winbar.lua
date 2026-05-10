function OleWinbarLine()
    local win = vim.g.statusline_winid
    local buf = vim.api.nvim_win_get_buf(win)
    local buftype = vim.api.nvim_get_option_value("buftype", { buf = buf })

    if buftype == "nofile" then
        return string.format("  Window %d", win)
    end

    local active = vim.api.nvim_get_current_win() == win
    local hl = active and "TabLineNameSel" or "TabLineName"

    local path = vim.api.nvim_buf_get_name(buf)

    if type(path) == "string" and path ~= "" then
        path = vim.fn.fnamemodify(path, ":~:.")
    else
        path = "[No Name]"
    end

    local file_comp = string.format("%%#%s# %s %%*", hl, path)

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

    local diag_comp = table.concat(diag_entries, " ")

    return file_comp .. "%=" .. diag_comp
end

vim.opt.winbar = "%!v:lua.OleWinbarLine()"
