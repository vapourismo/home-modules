return {
    {
        "catppuccin/nvim",
        enabled = true,
        name = "catppuccin",
        priority = 1000,
        lazy = false,
        opts = {
            flavour = "auto",
            background = {
                light = "latte",
                dark = "mocha",
            },
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
                    enabled = true,
                },
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
                    WinSeparator = { fg = colors.overlay0 },
                    WinBarName = { fg = colors.crust, bg = colors.surface1 },
                    WinBarNameActive = { fg = colors.crust, bg = colors.lavender, style = { "bold" } },
                    WinBarGap = { fg = colors.surface1, style = { "strikethrough" } },
                    WinBarGapActive = { fg = colors.lavender, style = { "strikethrough" } },
                    WinBarError = { fg = colors.crust, bg = colors.surface1 },
                    WinBarErrorActive = { fg = colors.crust, bg = colors.red },
                    WinBarWarn = { fg = colors.crust, bg = colors.surface1 },
                    WinBarWarnActive = { fg = colors.crust, bg = colors.yellow },
                    WinBarInfo = { fg = colors.crust, bg = colors.surface1 },
                    WinBarInfoActive = { fg = colors.crust, bg = colors.sky },
                    WinBarHint = { fg = colors.crust, bg = colors.surface1 },
                    WinBarHintActive = { fg = colors.crust, bg = colors.teal },
                    TermBarName = { fg = colors.base, bg = colors.surface0 },
                    TermBarNameActive = { fg = colors.base, bg = colors.surface0 },
                    TermBarNameFocused = { fg = colors.crust, bg = colors.lavender, style = { "bold" } },
                    TermBarStatus = { fg = colors.crust, bg = colors.maroon },
                    TermBarAttention = { fg = colors.red, bg = colors.surface1 },
                    Include = { style = {} },
                    CopilotSuggestion = { link = "Comment" },
                    SnacksPickerPrompt = { bg = colors.surface0 },
                    SnacksPickerTotals = { bg = colors.surface0 },
                    SnacksPickerSpinner = { bg = colors.surface0 },
                    SnacksPickerInput = { bg = colors.surface0 },
                    TreesitterContextLineNumber = { link = "NormalFloat" },
                    CursorLineNr = { bg = "#2a2b3d" },
                    CursorLineSign = { bg = "#2a2b3d" },
                    ZeddaGhostText = { fg = colors.overlay2, style = { "italic" } },
                }
            end
        },
        config = function(plugin, opts)
            local function update_term_colors()
                local colors = {}

                if vim.go.background == "dark" then
                    colors = require("catppuccin.palettes").get_palette("mocha")
                else
                    colors = require("catppuccin.palettes").get_palette("latte")
                end

                -- The dark color is too light out of the box
                vim.g.terminal_color_0 = colors.surface0
                vim.g.terminal_color_8 = colors.surface1
            end

            vim.api.nvim_create_autocmd({ "ColorScheme" }, {
                pattern = { "catppuccin" },
                callback = function()
                    vim.g.neovide_floating_shadow = false
                    update_term_colors()
                end
            })

            vim.api.nvim_create_autocmd({ "OptionSet" }, {
                pattern = { "background" },
                callback = function()
                    update_term_colors()
                end
            })

            require(plugin.name).setup(opts)
            vim.cmd("colorscheme catppuccin")
        end,
    },

    {
        "felipefdl/warm-burnout",
        enabled = false,
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

                    vim.api.nvim_set_hl(0, "SnacksPickerPrompt", { bg = palette.bg_highlight })
                    vim.api.nvim_set_hl(0, "SnacksPickerTotals", { bg = palette.bg_highlight })
                    vim.api.nvim_set_hl(0, "SnacksPickerSpinner", { bg = palette.bg_highlight })
                    vim.api.nvim_set_hl(0, "SnacksPickerInput", { bg = palette.bg_highlight })

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
}
