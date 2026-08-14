local function change_path_repr(path)
    local components = {}
    for comp in string.gmatch(path, "([^/]+)") do
        table.insert(components, comp)
    end

    local prefix = ""
    if string.match(path, "^/") then
        prefix = " "
    end

    return prefix .. table.concat(components, "  ")
end

local function buffer_path(buf, active)
    local hl_body = active and "WinBarNameActive" or "WinBarName"

    local path = vim.api.nvim_buf_get_name(buf)

    if type(path) == "string" and path ~= "" then
        path = vim.fn.fnamemodify(path, ":~:.")
        path = change_path_repr(path)
    else
        path = "[no name]"
    end

    return string.format(
        "%%#%s# %s %%*",
        hl_body,
        path
    )
end

local function lsp_diagnostics(buf, active)
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

    local mark_hl = function(hl, text, ...)
        if active then
            hl = hl .. "Active"
        end
        return "%#" .. hl .. "# " .. string.format(text, ...) .. " %*"
    end

    if errors > 0 then
        table.insert(diag_entries, mark_hl("WinBarError", "󰅚 %d", errors))
    end

    if warnings > 0 then
        table.insert(diag_entries, mark_hl("WinBarWarn", "󰀪 %d", warnings))
    end

    if infos > 0 then
        table.insert(diag_entries, mark_hl("WinBarInfo", "󰋽 %d", infos))
    end

    if hints > 0 then
        table.insert(diag_entries, mark_hl("WinBarHint", "󰌶 %d", hints))
    end

    if #diag_entries == 0 then
        return ""
    end

    local hl_gap = active and "%#WinBarGapActive#" or "%#WinBarGap#"
    return table.concat(diag_entries, hl_gap .. " %*")
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
    local diag_comp = lsp_diagnostics(buf, active)

    local hl_gap = active and "%#WinBarGapActive#" or "%#WinBarGap#"

    return hl_gap .. " " .. file_comp .. hl_gap .. "%=%*" .. diag_comp .. hl_gap .. " "
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
