return {
    "vapourismo/codex.nvim",
    opts = {
        on_notification = function(data)
            vim.notify(
                data.message or "Codex needs attention",
                vim.log.levels.INFO,
                { title = "Codex" }
            )

            local buf = data.buf
            local current_buf = vim.api.nvim_get_current_buf()

            if current_buf == buf then
                return
            end

            local current_tab = vim.api.nvim_get_current_tabpage()

            for _, tabpage in ipairs(vim.api.nvim_list_tabpages()) do
                if tabpage ~= current_tab then
                    for _, window in ipairs(vim.api.nvim_tabpage_list_wins(tabpage)) do
                        if vim.api.nvim_win_get_buf(window) == buf then
                            vim.api.nvim_tabpage_set_var(tabpage, "attention", true)
                            break
                        end
                    end
                end
            end
        end,
    },
    keys = {
        { "<D-r>", function() require("codex").toggle() end,    mode = { "n", "v", "i", "t" } },
        { "<D->>", function() require("codex").reference() end, mode = { "v" } },
    },
}
