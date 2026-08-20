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
                    TabLineNumSel = { fg = colors.crust, bg = colors.maroon },
                    TabLineNameSel = { fg = colors.crust, bg = colors.rosewater },
                    WinSeparator = { fg = colors.overlay0 },
                    WinBar = { fg = colors.lavender },
                    WinBarNC = { fg = colors.surface1 },
                    WinBarName = { fg = colors.crust, bg = colors.surface1 },
                    WinBarNameActive = { fg = colors.crust, bg = colors.lavender },
                    WinBarContext = { fg = colors.surface1 },
                    WinBarContextActive = { fg = colors.lavender },
                    WinBarError = { link = "WinBarName" },
                    WinBarErrorActive = { fg = colors.crust, bg = colors.red },
                    WinBarWarn = { link = "WinBarName" },
                    WinBarWarnActive = { fg = colors.crust, bg = colors.yellow },
                    WinBarInfo = { link = "WinBarName" },
                    WinBarInfoActive = { fg = colors.crust, bg = colors.sky },
                    WinBarHint = { link = "WinBarName" },
                    WinBarHintActive = { fg = colors.crust, bg = colors.teal },
                    TermBarName = { fg = colors.base, bg = colors.surface1 },
                    TermBarNameActive = { fg = colors.subtext1, bg = colors.surface1 },
                    TermBarNameFocused = { fg = colors.crust, bg = colors.lavender },
                    TermBarStatus = { fg = colors.crust, bg = colors.maroon },
                    TermBarAttention = { fg = colors.red, bg = colors.surface1 },
                    TermBar = { fg = colors.lavender, bg = colors.mantle },
                    TermBarNC = { fg = colors.surface1, bg = colors.mantle },
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
                    ZeddaChangeSign = { fg = colors.red },
                    ZeddaActiveChangeSign = { fg = colors.green },
                    ColorColumn = { fg = colors.red, bg = "NONE", style = { "bold" } },
                    StatusDiagnosticError = { link = "WinBarErrorActive" },
                    StatusDiagnosticWarn = { link = "WinBarWarnActive" },
                    StatusDiagnosticInfo = { link = "WinBarInfoActive" },
                    StatusDiagnosticHint = { link = "WinBarHintActive" },
                    StatusCursorPos = { fg = colors.base, bg = colors.blue },
                    StatusCwd = { fg = colors.base, bg = colors.lavender },
                    StatusFiletype = { fg = colors.base, bg = colors.rosewater },
                    StatusLsp = { fg = colors.base, bg = colors.peach },
                    StatusMacro = { fg = colors.base, bg = colors.maroon },
                    StatusModeCommand = { fg = colors.base, bg = colors.peach },
                    StatusModeConfirm = { link = "StatusModeCommand" },
                    StatusModeEx = { link = "StatusModeCommand" },
                    StatusModeInsert = { fg = colors.base, bg = colors.green },
                    StatusModeMore = { link = "StatusModeCommand" },
                    StatusModeNormal = { fg = colors.mantle, bg = colors.blue },
                    StatusModeOperatorPending = { link = "StatusModeNormal" },
                    StatusModePrompt = { link = "StatusModeCommand" },
                    StatusModeReplace = { fg = colors.base, bg = colors.red },
                    StatusModeSelect = { link = "StatusModeVisual" },
                    StatusModeSelectBlock = { link = "StatusModeVisual" },
                    StatusModeSelectLine = { link = "StatusModeVisual" },
                    StatusModeShell = { link = "StatusModeCommand" },
                    StatusModeTerminal = { link = "StatusModeInsert" },
                    StatusModeTerminalNormal = { link = "StatusModeNormal" },
                    StatusModeUnknown = { link = "StatusModeNormal" },
                    StatusModeVirtualReplace = { link = "StatusModeReplace" },
                    StatusModeVisual = { fg = colors.base, bg = colors.mauve },
                    StatusModeVisualBlock = { link = "StatusModeVisual" },
                    StatusModeVisualLine = { link = "StatusModeVisual" },
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
                pattern = { "catppuccin*" },
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
                    local palettes = require("warm-burnout.palette")
                    local palette

                    if info.match == "warm-burnout-light" then
                        palette = palettes.light
                    elseif info.match == "warm-burnout-dark" then
                        palette = palettes.dark
                    else
                        return
                    end

                    palette = palettes.resolve(palette)

                    local highlights = {
                        TabLineNum = { fg = palette.bg, bg = palette.bg_search },
                        TabLineName = { fg = palette.bg, bg = palette.bg_highlight },
                        TabLineNumSel = { fg = palette.bg_dim, bg = palette.member },
                        TabLineNameSel = { fg = palette.bg_dim, bg = palette.decorator },
                        WinSeparator = { fg = palette.accent },
                        WinBar = { fg = palette.decorator },
                        WinBarNC = { fg = palette.fg_gutter },
                        WinBarName = { fg = palette.bg_dim, bg = palette.bg_highlight },
                        WinBarNameActive = { fg = palette.bg_dim, bg = palette.decorator },
                        WinBarContext = { fg = palette.fg_gutter },
                        WinBarContextActive = { fg = palette.decorator },
                        WinBarError = { link = "WinBarName" },
                        WinBarErrorActive = { fg = palette.bg_dim, bg = palette.error },
                        WinBarWarn = { link = "WinBarName" },
                        WinBarWarnActive = { fg = palette.bg_dim, bg = palette.warn },
                        WinBarInfo = { link = "WinBarName" },
                        WinBarInfoActive = { fg = palette.bg_dim, bg = palette.info },
                        WinBarHint = { link = "WinBarName" },
                        WinBarHintActive = { fg = palette.bg_dim, bg = palette.hint },
                        TermBarName = { fg = palette.bg, bg = palette.bg_highlight },
                        TermBarNameActive = { fg = palette.fg_dim, bg = palette.bg_highlight },
                        TermBarNameFocused = { fg = palette.bg_dim, bg = palette.decorator },
                        TermBarStatus = { fg = palette.bg_dim, bg = palette.member },
                        TermBarAttention = { fg = palette.error, bg = palette.bg_highlight },
                        TermBar = { fg = palette.decorator, bg = palette.bg_dim },
                        TermBarNC = { fg = palette.fg_gutter, bg = palette.bg_dim },
                        Include = { fg = palette.keyword },
                        CopilotSuggestion = { link = "Comment" },
                        SnacksPickerPrompt = { bg = palette.bg_highlight },
                        SnacksPickerTotals = { bg = palette.bg_highlight },
                        SnacksPickerSpinner = { bg = palette.bg_highlight },
                        SnacksPickerInput = { bg = palette.bg_highlight },
                        TreesitterContextLineNumber = { link = "NormalFloat" },
                        CursorLineNr = { bg = palette.bg_highlight },
                        CursorLineSign = { bg = palette.bg_highlight },
                        ZeddaGhostText = { fg = palette.comment, italic = true },
                        ZeddaChangeSign = { fg = palette.error },
                        ZeddaActiveChangeSign = { fg = palette.added },
                        ColorColumn = { fg = palette.error, bg = palette.none, bold = true },
                        StatusDiagnosticError = { link = "WinBarErrorActive" },
                        StatusDiagnosticWarn = { link = "WinBarWarnActive" },
                        StatusDiagnosticInfo = { link = "WinBarInfoActive" },
                        StatusDiagnosticHint = { link = "WinBarHintActive" },
                        StatusCursorPos = { fg = palette.bg, bg = palette.modified },
                        StatusCwd = { fg = palette.bg, bg = palette.decorator },
                        StatusFiletype = { fg = palette.bg, bg = palette.tag },
                        StatusLsp = { fg = palette.bg, bg = palette.func },
                        StatusMacro = { fg = palette.bg, bg = palette.member },
                        StatusModeCommand = { fg = palette.bg, bg = palette.func },
                        StatusModeConfirm = { link = "StatusModeCommand" },
                        StatusModeEx = { link = "StatusModeCommand" },
                        StatusModeInsert = { fg = palette.bg, bg = palette.added },
                        StatusModeMore = { link = "StatusModeCommand" },
                        StatusModeNormal = { fg = palette.bg_dim, bg = palette.modified },
                        StatusModeOperatorPending = { link = "StatusModeNormal" },
                        StatusModePrompt = { link = "StatusModeCommand" },
                        StatusModeReplace = { fg = palette.bg, bg = palette.error },
                        StatusModeSelect = { link = "StatusModeVisual" },
                        StatusModeSelectBlock = { link = "StatusModeVisual" },
                        StatusModeSelectLine = { link = "StatusModeVisual" },
                        StatusModeShell = { link = "StatusModeCommand" },
                        StatusModeTerminal = { link = "StatusModeInsert" },
                        StatusModeTerminalNormal = { link = "StatusModeNormal" },
                        StatusModeUnknown = { link = "StatusModeNormal" },
                        StatusModeVirtualReplace = { link = "StatusModeReplace" },
                        StatusModeVisual = { fg = palette.bg, bg = palette.number },
                        StatusModeVisualBlock = { link = "StatusModeVisual" },
                        StatusModeVisualLine = { link = "StatusModeVisual" },
                    }

                    for hlname, def in pairs(highlights) do
                        vim.api.nvim_set_hl(0, hlname, def)
                    end

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
