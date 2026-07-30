vim.diagnostic.config({
    virtual_text = false,
    virtual_lines = false,
    underline = true,
    severity_sort = true,
    update_in_insert = true,
    float = {
        border = { " ", " ", " ", " ", " ", " ", " ", " " },
    },
    signs = {
        active = true,
        numhl = {
            [vim.diagnostic.severity.ERROR] = "LspDiagnosticsError",
            [vim.diagnostic.severity.WARN] = "LspDiagnosticsWarning",
            [vim.diagnostic.severity.HINT] = "LspDiagnosticsHint",
            [vim.diagnostic.severity.INFO] = "LspDiagnosticsInformation",
        },
    },
})

local diagnostic_open_float = vim.diagnostic.open_float
vim.diagnostic.open_float = function(...)
    local float_bufnr, winid = diagnostic_open_float(...)
    if not float_bufnr or vim.b[float_bufnr].diagnostic_padding_applied then
        return float_bufnr, winid
    end

    local lines = vim.api.nvim_buf_get_lines(float_bufnr, 0, -1, false)
    vim.bo[float_bufnr].modifiable = true
    for line_number, line in ipairs(lines) do
        local row = line_number - 1
        vim.api.nvim_buf_set_text(float_bufnr, row, #line, row, #line, { " " })
        vim.api.nvim_buf_set_text(float_bufnr, row, 0, row, 0, { " " })
    end
    vim.bo[float_bufnr].modifiable = false

    local config = vim.api.nvim_win_get_config(winid)
    vim.api.nvim_win_set_config(winid, { width = config.width + 2 })
    vim.b[float_bufnr].diagnostic_padding_applied = true

    return float_bufnr, winid
end
