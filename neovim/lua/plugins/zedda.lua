return {
    "vapourismo/zedda.nvim",
    url = "git@github.com:vapourismo/zedda.nvim.git",
    build = function()
        require("zedda").build()
    end,
    opts = {},
}
