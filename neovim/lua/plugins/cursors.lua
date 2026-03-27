return {
    "jake-stewart/multicursor.nvim",
    branch = "1.0",
    config = function()
        local mc = require("multicursor-nvim")
        mc.setup()

        -- Make sure we don't accidentally replace stuff
        vim.keymap.set({ "n", "x" }, "r", "<nop>")
        vim.keymap.set({ "n", "x" }, "R", "<nop>")

        -- Add or skip cursor above/below the main cursor
        vim.keymap.set({ "n", "x" }, "<M-k>", function() mc.lineAddCursor(-1) end)
        vim.keymap.set({ "n", "x" }, "<M-j>", function() mc.lineAddCursor(1) end)
        vim.keymap.set({ "n", "x" }, "<M-S-k>", function() mc.lineSkipCursor(-1) end)
        vim.keymap.set({ "n", "x" }, "<M-S-j>", function() mc.lineSkipCursor(1) end)

        -- Add or skip adding a new cursor by matching word/selection
        vim.keymap.set({ "n", "x" }, "rk", function() mc.matchAddCursor(-1) end)
        vim.keymap.set({ "n", "x" }, "rj", function() mc.matchAddCursor(1) end)
        vim.keymap.set({ "n", "x" }, "<D-d>", function() mc.matchAddCursor(1) end)
        vim.keymap.set({ "n", "x" }, "rK", function() mc.matchSkipCursor(-1) end)
        vim.keymap.set({ "n", "x" }, "rJ", function() mc.matchSkipCursor(1) end)
        vim.keymap.set({ "n", "x" }, "<D-S-d>", function() mc.matchSkipCursor(1) end)
        vim.keymap.set({ "n", "x" }, "rA", mc.matchAllAddCursors)

        -- Match new cursors within visual selections by regex
        vim.keymap.set("x", "M", mc.matchCursors)

        -- Mappings defined in a keymap layer only apply when there are
        -- multiple cursors. This lets you have overlapping mappings.
        mc.addKeymapLayer(function(layerSet)
            -- Select a different cursor as the main one.
            layerSet({ "n", "x" }, "rh", mc.prevCursor)
            layerSet({ "n", "x" }, "<M-h>", mc.prevCursor)
            layerSet({ "n", "x" }, "rl", mc.nextCursor)
            layerSet({ "n", "x" }, "<M-l>", mc.nextCursor)

            -- Delete the main cursor.
            layerSet({ "n", "x" }, "rx", mc.deleteCursor)

            -- Enable and clear cursors using escape.
            layerSet("n", "<esc>", function()
                if not mc.cursorsEnabled() then
                    mc.enableCursors()
                else
                    mc.clearCursors()
                end
            end)
        end)

        -- Customize how cursors look.
        vim.api.nvim_set_hl(0, "MultiCursorCursor", { reverse = true })
        vim.api.nvim_set_hl(0, "MultiCursorVisual", { link = "Visual" })
        vim.api.nvim_set_hl(0, "MultiCursorSign", { link = "SignColumn" })
        vim.api.nvim_set_hl(0, "MultiCursorMatchPreview", { link = "Search" })
        vim.api.nvim_set_hl(0, "MultiCursorDisabledCursor", { reverse = true })
        vim.api.nvim_set_hl(0, "MultiCursorDisabledVisual", { link = "Visual" })
        vim.api.nvim_set_hl(0, "MultiCursorDisabledSign", { link = "SignColumn" })
    end
}
