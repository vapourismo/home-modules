local function remove_layout_borders(layout)
    layout.layout.border = "none"

    for _, win in ipairs(layout.layout) do
        win.border = "none"
    end

    return layout
end

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
            layouts = {
                vscode = {
                    config = remove_layout_borders,
                },
                vertical = {
                    config = remove_layout_borders,
                },
                ivy = {
                    config = remove_layout_borders,
                },
                bottom = {
                    config = remove_layout_borders,
                },
                select = {
                    config = remove_layout_borders,
                },
            },
            layout = {
                config = remove_layout_borders,
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
            function()
                Snacks.picker.files({
                    layout = "select",
                })
            end
        },
        {
            "<Space>F",
            function()
                Snacks.picker.projects({
                    layout = "select",
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
            function()
                Snacks.picker.lines({
                    layout = {
                        preset = "bottom",
                        preview = false,
                    },
                })
            end
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
