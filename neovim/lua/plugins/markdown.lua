return {
    "MeanderingProgrammer/render-markdown.nvim",
    dependencies = {
        "nvim-treesitter/nvim-treesitter"
    },
    ft = { "markdown", "opencode_output" },
    opts = {
        heading = {
            icons = { "█ ", "██ ", "███ ", "████ ", "█████ ", "██████ " },
        },
        code = {
            sign = false,
            style = "normal",
        },
    },
}
