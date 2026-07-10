return {
    "vapourismo/codex.nvim",
    opts = {},
    keys = {
        { "<D-r>", function() require("codex").toggle() end,    mode = { "n", "v", "i", "t" } },
        { "<D->>", function() require("codex").reference() end, mode = { "v" } },
    },
}
