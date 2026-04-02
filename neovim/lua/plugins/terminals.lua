--- @class AllSnackTerminals
--- @field counter number A counter to assign unique IDs to terminals.
--- @field last_window_id number? The ID of the last terminal window that was shown.
AllSnackTerminals = {
    counter = 0,
    last_window_id = nil,
}

--- Create an iterator over all terminals.
function AllSnackTerminals.iter_terminals()
    local terms = Snacks.terminal.list()
    local dir = vim.fn.getcwd(-1, 0)

    local local_terms = vim.tbl_filter(
        function(term)
            return term.dir == dir
        end,
        terms
    )

    return pairs(local_terms)
end

--- Gets the ID of the terminal that comes after the given ID in the list.
--- @param id number
--- @return number?
function AllSnackTerminals.next_id(id)
    local bigger_id = nil

    for _, term in AllSnackTerminals.iter_terminals() do
        if term.id > id then
            bigger_id = math.min(term.id, bigger_id or term.id)
        end
    end

    return bigger_id
end

--- Gets the ID of the terminal that comes before the given ID in the list.
--- @param id number
--- @return number?
function AllSnackTerminals.prev_id(id)
    local smaller_id = nil

    for _, term in AllSnackTerminals.iter_terminals() do
        if term.id < id then
            smaller_id = math.max(term.id, smaller_id or term.id)
        end
    end

    return smaller_id
end

--- Gets a terminal by its ID.
--- @param id? number
function AllSnackTerminals.get_by_id(id)
    for _, term in AllSnackTerminals.iter_terminals() do
        if term.id == id then
            return term
        end
    end

    return nil
end

--- Creates a new terminal with the given command.
--- @param cmd? string
function AllSnackTerminals:new(cmd)
    local count = self.counter
    self.counter = self.counter + 1

    local dir = vim.fn.getcwd(-1, 0)

    local win = Snacks.terminal(
        cmd,
        {
            cwd = dir,
            count = count
        }
    )

    win.dir = dir
    win.status = nil

    vim.api.nvim_create_autocmd({ "TermClose" }, {
        buffer = win.buf,
        once = true,
        callback = function()
            local status = vim.v.event and vim.v.event.status or -1

            win.status = status

            if type(status) == "number" and status > 0 then
                vim.notify("Command failed: " .. cmd, vim.log.levels.ERROR)
            end

            if status == 0 then
                win:close()
            end
        end,
    })
end

--- Toggles the visibility of the current terminal.
function AllSnackTerminals:toggle()
    local current_id = vim.w.snacks_win and vim.w.snacks_win.id
    local current_term = current_id and self.get_by_id(current_id)

    if current_term then
        current_term:hide()
        return
    end

    local last_term =
        self.last_window_id
        and (
            self.get_by_id(self.last_window_id)
            or self.get_by_id(self.prev_id(self.last_window_id))
            or self.get_by_id(self.next_id(self.last_window_id))
        )

    if last_term then
        last_term:show()
        return
    end

    for _, term in self.iter_terminals() do
        term:show()
        return
    end

    self:new()
end

--- Shows the next terminal in the list, if any.
function AllSnackTerminals:next()
    local current_id = vim.w.snacks_win and vim.w.snacks_win.id
    local next_id = current_id and self.next_id(current_id)
    local next_term = next_id and self.get_by_id(next_id)

    if next_term then
        next_term:show()
        return true
    end

    return false
end

--- Shows the previous terminal in the list, if any.
function AllSnackTerminals:prev()
    local current_id = vim.w.snacks_win and vim.w.snacks_win.id
    local prev_id = current_id and self.prev_id(current_id)
    local prev_term = prev_id and self.get_by_id(prev_id)

    if prev_term then
        prev_term:show()
        return true
    end

    return false
end

--- Closes the current terminal and shows the next or previous one, if any.
function AllSnackTerminals:close()
    local current_id = vim.w.snacks_win and vim.w.snacks_win.id
    local current_term = current_id and self.get_by_id(current_id)

    if not current_term then
        return
    end

    if self:prev() or self:next() then
        current_term:close()
    end
end

function TerminalWinbarLine()
    local current_id = vim.w.snacks_win and vim.w.snacks_win.id

    local items = {}

    for _, term in AllSnackTerminals.iter_terminals() do
        local hl = "TabLineName"
        local hl_num = "TabLineNum"

        if term.id == current_id then
            hl = "TabLineNameSel"
            hl_num = "TabLineNumSel"
        end

        local title = term.cmd or "terminal"
        local item

        if term.status == nil or term.status == 0 then
            item = string.format("%%#%s# %s %%*", hl, title)
        else
            item = string.format("%%#%s# %s %%#%s# ☠ %%*", hl, title, hl_num)
        end

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
    "vapourismo/snacks.nvim",
    branch = "feature/workspace-symbols-all-clients",
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
                    q = false,
                    ["<D-S-N>"] = {
                        function()
                            AllSnackTerminals:new()
                        end,
                        mode = { "n", "t", "v" }
                    },
                    ["<D-w>"] = {
                        function()
                            AllSnackTerminals:close()
                        end,
                        mode = { "n", "t", "v" }
                    },
                    ["<D-{>"] = {
                        function()
                            AllSnackTerminals:prev()
                        end,
                        mode = { "n", "t", "v" }
                    },
                    ["<D-}>"] = {
                        function()
                            AllSnackTerminals:next()
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

                        AllSnackTerminals:new(cmd)
                    end
                )
            end,
            mode = { "n", "t", "v", "i" }
        },
        {
            "<D-§>",
            function()
                AllSnackTerminals:toggle()
            end,
            mode = { "n", "t", "v", "i" }
        },
    },
}
