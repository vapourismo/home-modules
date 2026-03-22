return {
    "vapourismo/snacks.nvim",
    branch = "feature/workspace-symbols-all-clients",
    priority = 1000,
    lazy = false,
    opts = {
        picker = {
            icons = {
                files = {
                    enabled = false
                }
            },
        },
        zen = {
            toggles = {
                dim = false
            },
            show = {
                statusline = true
            }
        },
        styles = {
            zen = {
                width = 140
            },
        }
    },
    keys = {
        {
            "<Space>z",
            function() Snacks.zen() end
        },
        {
            "<Space>=",
            function() Snacks.picker.pickers() end
        },
        {
            "<D-S-E>",
            function() Snacks.picker.explorer() end
        },
        {
            "<Space>f",
            function() Snacks.picker.files({ layout = "vscode" }) end
        },
        {
            "<Space>F",
            function()
                Snacks.picker.projects({
                    dev = { "~/Workspaces" },
                    patterns = { ".jj", ".git" },
                    confirm = {
                        function(_, _)
                            Snacks.bufdelete.all()
                        end,
                        "tcd",
                        function(picker, _)
                            picker:close()
                        end
                    },
                })
            end
        },
        {
            "<Space>/",
            function() Snacks.picker.grep() end
        },
        {
            "<Space>b",
            function() Snacks.picker.buffers() end
        },
        {
            "<Space>d",
            function()
                Snacks.picker.diagnostics_buffer({
                    layout = "bottom"
                })
            end
        },
        {
            "<Space>D",
            function()
                Snacks.picker.diagnostics({
                    layout = "bottom"
                })
            end
        },
        {
            "<Space>s",
            function()
                Snacks.picker.lsp_symbols({
                    tree = false,
                    filter = { default = true },
                })
            end
        },
        {
            "<Space>S",
            function()
                Snacks.picker.lsp_workspace_symbols({
                    all_clients = true,
                })
            end
        },
        {
            "<Space>l",
            function() Snacks.picker.lines() end
        },
        {
            "gr",
            function() Snacks.picker.lsp_references() end
        },
        {
            "gd",
            function() Snacks.picker.lsp_definitions() end
        },
        {
            "gt",
            function() Snacks.picker.lsp_type_definitions() end
        },
    },
}
