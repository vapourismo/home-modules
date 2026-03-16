return {
    -- Upstream:
    -- "sudo-tee/opencode.nvim",
    -- Patched:
    "vapourismo/opencode.nvim",
    dependencies = {
        "nvim-lua/plenary.nvim",
        "hrsh7th/nvim-cmp",
        "folke/snacks.nvim",
        "MeanderingProgrammer/render-markdown.nvim",
    },
    opts = {
        keymap_prefix = "<Space>o",
        context = {
            current_file = {
                enabled = false
            },
            diagnostics = {
                enabled = false,
            },
        },
        keymap = {
            editor = {
                ["<D-r>"] = { "toggle" },
                ["<D->>"] = { "add_visual_selection", mode = { "v" } },
            },
            input_window = {
                ["<D-cr>"] = { "submit_input_prompt", mode = { "n", "i" } },
            }
        },
        ui = {
            window_width = 0.3,
            output = {
                filetype = "markdown",
                tools = {
                    show_output = false,
                    show_reasoning_output = false
                },
            },
        },
    },
}
