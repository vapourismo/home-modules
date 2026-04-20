return {
    "aznhe21/actions-preview.nvim",
    config = function()
        local actions_preview = require("actions-preview")

        actions_preview.setup({
            diff = {
                ctxlen = 5,
            },
            backend = { "snacks" }
        })

        vim.keymap.set("", "<Space>a", actions_preview.code_actions)
    end,
}
