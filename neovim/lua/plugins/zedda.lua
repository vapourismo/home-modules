return {
    "vapourismo/zedda.nvim",
    -- url = "git@github.com:vapourismo/zedda.nvim.git",
    dir = "~/Workspaces/zedda.nvim",
    build = function()
        require("zedda").build()
    end,
    opts = {},
    config = function(_, opts)
        require("zedda").setup(opts)

        -- Our themes don't like italics
        vim.schedule(function()
            vim.cmd("highlight ZeddaGhostText gui=italic")
        end)
    end,
}
