return {
    {
        "nvim-treesitter/nvim-treesitter",
        lazy = false,
        build = ":TSUpdate",
        opts = {
            indent = {
                enable = true
            },
            highlight = {
                enable = true
            },
        }
    },
    {
        "nvim-treesitter/nvim-treesitter-context",
        opts = {
            mode = "topline",
        },
    },
}
