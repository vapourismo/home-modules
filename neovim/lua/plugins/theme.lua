return {
    {
        "catppuccin/nvim",
        enabled = false,
        name = "catppuccin",
        priority = 1000,
        lazy = false,
        opts = {
            flavour = "mocha",
            term_colors = true,
            integrations = {
                native_lsp = {
                    enabled = true,
                    inlay_hints = {
                        background = false,
                    },
                },
                treesitter_context = false,
                noice = true,
                snacks = {
                    enabled = false,
                },
                dropbar = {
                    enabled = true,
                    color_mode = false,
                }
            },
            no_italic = true,
            styles = {
                comments = {},
                keywords = {},
                types = {},
            },
            custom_highlights = function(colors)
                return {
                    TabLineNum = { fg = colors.base, bg = colors.surface1 },
                    TabLineName = { fg = colors.base, bg = colors.surface0 },
                    TabLineNumSel = { fg = colors.crust, bg = colors.maroon, style = { "bold" } },
                    TabLineNameSel = { fg = colors.crust, bg = colors.rosewater, style = { "bold" } },
                    Include = { style = {} },
                    CopilotSuggestion = { link = "Comment" },
                }
            end
        },
        config = function(plugin, opts)
            require(plugin.name).setup(opts)
            vim.cmd("colorscheme catppuccin")
        end,
    },

    {
        "felipefdl/warm-burnout",
        priority = 1000,
        lazy = false,
        config = function(plugin)
            vim.opt.rtp:append(plugin.dir .. "/nvim")

            vim.api.nvim_create_autocmd({ "ColorScheme" }, {
                pattern = { "warm-burnout-light", "warm-burnout-dark" },
                callback = function(info)
                    local palette = require("warm-burnout.palette")

                    if info.match == "warm-burnout-light" then
                        palette = palette.light
                    elseif info.match == "warm-burnout-dark" then
                        palette = palette.dark
                    else
                        return
                    end

                    vim.api.nvim_set_hl(0, "TabLineName", { bg = palette.bg_highlight })
                    vim.api.nvim_set_hl(0, "TabLineNameSel", { fg = palette.bg_dim, bg = palette.decorator })
                    vim.api.nvim_set_hl(0, "TabLineNum", { bg = palette.bg_search })
                    vim.api.nvim_set_hl(0, "TabLineNumSel", { fg = palette.bg_dim, bg = palette.member })

                    vim.api.nvim_set_hl(0, "WinBarName", { bg = palette.bg_highlight })
                    vim.api.nvim_set_hl(0, "WinBarNameActive", { fg = palette.bg_dim, bg = palette.decorator })

                    vim.api.nvim_set_hl(0, "NormalFloat", { bg = palette.bg })

                    vim.api.nvim_set_hl(0, "WinSeparator", { fg = palette.accent })

                    vim.api.nvim_set_hl(0, "TreesitterContext", { bg = palette.bg_float })
                    vim.api.nvim_set_hl(0, "TreesitterContextLineNumber", { bg = palette.bg_float })

                    vim.fn.foreach(vim.api.nvim_get_hl(0, {}), function(hlname, def)
                        local is_italic = def.italic or def.cterm and def.cterm.italic
                        if not is_italic then
                            return
                        end

                        local disabled_def = vim.tbl_deep_extend("force", def,
                            { italic = false, cterm = { italic = false } })
                        vim.api.nvim_set_hl(0, hlname, disabled_def)
                    end)
                end
            })

            vim.cmd("colorscheme warm-burnout-dark")
        end,
    },

    {
        "folke/noice.nvim",
        event = "VeryLazy",
        opts = {
            popupmenu = {
                backend = "cmp"
            },
            lsp       = {
                override = {
                    ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
                    ["vim.lsp.util.stylize_markdown"] = true,
                    ["cmp.entry.get_documentation"] = true,
                },
            },
            presets   = {
                bottom_search = true,
                command_palette = true,
                long_message_to_split = true,
                inc_rename = false,
                lsp_doc_border = false,
            },
        },
        dependencies = {
            "MunifTanjim/nui.nvim",
        }
    }
}
