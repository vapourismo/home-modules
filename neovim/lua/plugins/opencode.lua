return {
    "sudo-tee/opencode.nvim",
    enabled = false,
    dependencies = {
        "nvim-lua/plenary.nvim",
        "saghen/blink.cmp",
        "vapourismo/snacks.nvim",
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
                ["<D-r>"] = { "toggle", mode = { "n", "i", "v", "t" } },
                ["<D->>"] = { "add_visual_selection", mode = { "v" } },
            },
            output_window = {
                ["<esc>"] = false,
            },
            input_window = {
                ["<esc>"] = false,
                ["<D-cr>"] = { "submit_input_prompt", mode = { "n", "i", "v" } },
            }
        },
        ui = {
            window_width = 0.4,
            output = {
                filetype = "markdown",
                tools = {
                    show_output = false,
                    show_reasoning_output = false
                },
                compact_assistant_headers = "hidden",
            },
        },
        debug = {
            show_ids = false
        }
    },
}
