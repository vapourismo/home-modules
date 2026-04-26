return {
    "vapourismo/cursortab.nvim",
    lazy = false,
    build = "cd server && go build",
    opts = {
        keymaps = {
            accept = "<M-l>",
            partial_accept = "<M-S-L>",
            trigger = false,
        },
        provider = {
            type = "mercuryapi",
            api_key_env = "INCEPTION_API_KEY",
            model = "mercury-edit-2",
        },
        behavior = {
            ignore_filetypes = {
                "",
                "terminal",
                "snacks_input",
                "snacks_picker_input",
                "opencode",
            },
        },
        ui = {
            jump = {
                symbol = "◀",
                text = "Jump",
            },
        },
    },
}
