return {
    "MeanderingProgrammer/render-markdown.nvim",
    dependencies = {
        "nvim-treesitter/nvim-treesitter"
    },
    ft = { "markdown", "opencode_output" },
    opts = {
        anti_conceal = { enabled = false },
        file_types = { "markdown", "opencode_output" },
        heading = {
            sign = false,
            position = "overlay",
            icons = { "█ ", "██ ", "███ ", "████ ", "█████ ", "██████ " },
            width = "full",
        },
        code = {
            sign = false,
            style = "normal",
        },
        checkbox = {
            unchecked = {
                icon = "",
            },
            checked = {
                icon = "",
            },
        },
        quote = {
            icon = "▏",
        },
        pipe_table = {
            style = "normal",
        }
    },
}
