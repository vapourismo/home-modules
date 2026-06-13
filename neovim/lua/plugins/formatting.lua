return {
    "stevearc/conform.nvim",
    opts = {
        formatters_by_ft = {
            javascript = { "prettier" },
            javascriptreact = { "prettier" },
            typescript = { "prettier" },
            typescriptreact = { "prettier" },
        },
        format_on_save = {
            lsp_format = "fallback",
            timeout_ms = 500,
        },
    },
}
