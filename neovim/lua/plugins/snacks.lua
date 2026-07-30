local blank_border = { " ", " ", " ", " ", " ", " ", " ", " " }

local function pad_layout(layout)
    local root = layout.layout
    local children = {
        box = root.box,
        border = "hpad",
    }

    for _, win in ipairs(root) do
        win.border = "none"
        table.insert(children, win)
    end

    for index = #root, 1, -1 do
        root[index] = nil
    end

    root.title = nil
    root.border = blank_border
    root[1] = children

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
                    config = pad_layout,
                },
                vertical = {
                    config = pad_layout,
                },
                ivy = {
                    config = pad_layout,
                },
                bottom = {
                    config = pad_layout,
                },
                select = {
                    config = pad_layout,
                },
            },
            layout = {
                config = pad_layout,
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
            "<D-b>",
            function() Snacks.picker.explorer() end
        },
        {
            "<Space>f",
            function()
                Snacks.picker.files({
                    layout = "select",
                    hidden = true,
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
            "grr",
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
