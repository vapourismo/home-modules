return {
    "vapourismo/zedda.nvim",
    url = "git@github.com:vapourismo/zedda.nvim.git",
    build = function()
        require("zedda").build()
    end,
    config = function()
        require("zedda").setup({})

        -- Our themes don't like italics
        vim.schedule(function()
            vim.cmd("highlight ZeddaGhostText gui=italic")
        end)
    end,
}
