return {
    "aznhe21/actions-preview.nvim",
    config = function()
        local actions_preview = require("actions-preview")
        vim.keymap.set("", "<Space>a", actions_preview.code_actions)
    end,
}
