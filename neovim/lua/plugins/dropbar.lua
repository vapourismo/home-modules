return {
    "Bekaboo/dropbar.nvim",
    config = function()
        local default_opts = require("dropbar.configs").opts
        local dropbar = require("dropbar")
        local dropbar_api = require("dropbar.api")

        local ignore_fts = { "", "snacks_terminal", "noice" }

        dropbar.setup({
            bar = {
                enable = function(buf, win, info)
                    if not default_opts.bar.enable(buf, win, info) then
                        return false
                    end

                    buf = vim._resolve_bufnr(buf)

                    if vim.tbl_contains(ignore_fts, vim.bo[buf].ft) then
                        return false
                    end

                    return true
                end
            }
        })

        vim.keymap.set("n", "<Leader>;", dropbar_api.pick, { desc = "Pick symbols in winbar" })
        vim.keymap.set("n", "[;", dropbar_api.goto_context_start, { desc = "Go to start of current context" })
        vim.keymap.set("n", "];", dropbar_api.select_next_context, { desc = "Select next context" })
    end
}
