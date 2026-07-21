return {
    "aznhe21/actions-preview.nvim",
    opts = {
        diff = {
            ctxlen = 5,
        },
        backend = { "snacks" },
        snacks = {
            layout = {
                preset = "dropdown",
            },
        },
    },
    keys = {
        {
            "<Space>a",
            function() require("actions-preview").code_actions() end,
            desc = "Code actions",
            mode = { "n", "v" },
        },
    },
}
