AllSnackTerminals = {
    counter = 0,
    last_window_id = nil,
}

function AllSnackTerminals.next_id(id)
    local bigger_id = nil

    for _, term in pairs(Snacks.terminal.list()) do
        if term.id > id then
            bigger_id = math.min(term.id, bigger_id or term.id)
        end
    end

    return bigger_id
end

function AllSnackTerminals.prev_id(id)
    local smaller_id = nil

    for _, term in pairs(Snacks.terminal.list()) do
        if term.id < id then
            smaller_id = math.max(term.id, smaller_id or term.id)
        end
    end

    return smaller_id
end

function AllSnackTerminals.get_by_id(id)
    for _, term in pairs(Snacks.terminal.list()) do
        if term.id == id then
            return term
        end
    end

    return nil
end

function AllSnackTerminals.new(cmd)
    local count = AllSnackTerminals.counter
    AllSnackTerminals.counter = AllSnackTerminals.counter + 1

    Snacks.terminal(
        cmd,
        {
            cwd = vim.fn.getcwd(-1, 0),
            count = count
        }
    )
end

function AllSnackTerminals.toggle()
    local current_id = vim.w.snacks_win and vim.w.snacks_win.id
    local current_term = current_id and AllSnackTerminals.get_by_id(current_id)

    if current_term then
        current_term:hide()
        return
    end

    local last_term =
        AllSnackTerminals.last_window_id
        and (
            AllSnackTerminals.get_by_id(AllSnackTerminals.last_window_id)
            or AllSnackTerminals.get_by_id(AllSnackTerminals.prev_id(AllSnackTerminals.last_window_id))
            or AllSnackTerminals.get_by_id(AllSnackTerminals.next_id(AllSnackTerminals.last_window_id))
        )

    if last_term then
        last_term:show()
        return
    end

    AllSnackTerminals.new()
end

function AllSnackTerminals.next()
    local current_id = vim.w.snacks_win and vim.w.snacks_win.id
    local next_id = current_id and AllSnackTerminals.next_id(current_id)
    local next_term = next_id and AllSnackTerminals.get_by_id(next_id)

    if next_term then
        next_term:show()
        return true
    end

    return false
end

function AllSnackTerminals.prev()
    local current_id = vim.w.snacks_win and vim.w.snacks_win.id
    local prev_id = current_id and AllSnackTerminals.prev_id(current_id)
    local prev_term = prev_id and AllSnackTerminals.get_by_id(prev_id)

    if prev_term then
        prev_term:show()
        return true
    end

    return false
end

function AllSnackTerminals.close()
    local current_id = vim.w.snacks_win and vim.w.snacks_win.id
    local current_term = current_id and AllSnackTerminals.get_by_id(current_id)

    if not current_term then
        return
    end

    if AllSnackTerminals.prev() or AllSnackTerminals.next() then
        current_term:close()
    end
end

function TerminalWinbarLine()
    local current_id = vim.w.snacks_win and vim.w.snacks_win.id

    local items = {}

    for _, term in pairs(Snacks.terminal.list()) do
        local hl = "TabLineName"
        local hl_num = "TabLineNum"

        if term.id == current_id then
            hl = "TabLineNameSel"
            hl_num = "TabLineNumSel"
        end

        local title = term.cmd or "terminal"

        local item = string.format("%%#%s# %i %%#%s# %s %%*", hl_num, term.id, hl, title)
        table.insert(items, { id = term.id, str = item })
    end

    table.sort(items, function(lhs, rhs) return lhs.id < rhs.id end)

    for i, v in ipairs(items) do
        items[i] = v.str
    end

    local items_str = table.concat(items, " ")
    return string.format("%%=%s%%=", items_str)
end

return {
    "folke/snacks.nvim",
    opts = {
        styles = {
            terminal = {
                max_width = 220,
                position = "float",
                on_buf = function(win)
                    AllSnackTerminals.last_window_id = win.id
                end,
                w = {
                    close_on_leave = true,
                },
                wo = {
                    foldmethod = "manual",
                    foldtext = "foldtext()",
                    winbar = "%!v:lua.TerminalWinbarLine()",
                },
                keys = {
                    ["<D-n>"] = {
                        function()
                            AllSnackTerminals.new()
                        end,
                        mode = { "n", "t", "v" }
                    },
                    ["<D-w>"] = {
                        function()
                            AllSnackTerminals.close()
                        end,
                        mode = { "n", "t", "v" }
                    },
                    ["<D-h>"] = {
                        function()
                            AllSnackTerminals.prev()
                        end,
                        mode = { "n", "t", "v" }
                    },
                    ["<D-l>"] = {
                        function()
                            AllSnackTerminals.next()
                        end,
                        mode = { "n", "t", "v" }
                    },
                    term_normal = {
                        "<esc>",
                        function(self)
                            local opts = self.opts and self.opts.w
                            if opts and opts.ole_captive then
                                return "<esc>"
                            else
                                vim.cmd("stopinsert")
                            end
                        end,
                        mode = "t",
                        expr = true,
                    },
                },
            }
        }
    },
    keys = {
        {
            "<D-S-R>",
            function()
                Snacks.input(
                    {
                        prompt = "Command"
                    },
                    function(cmd)
                        if cmd == "" or cmd == nil then
                            return
                        end

                        AllSnackTerminals.new(cmd)
                    end
                )
            end,
            mode = { "n", "t", "v", "i" }
        },
        {
            "<D-§>",
            function()
                AllSnackTerminals.toggle()
            end,
            mode = { "n", "t", "v", "i" }
        },
    },
}
