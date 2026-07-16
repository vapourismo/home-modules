return {
    "nanozuki/tabby.nvim",
    config = function()
        local tabby = require("tabby")
        local api = require("tabby.module.api")

        tabby.setup({
            line = function(line)
                local tabs = line.tabs().foreach(
                    function(tab)
                        local suffix = tab.is_current() and "Sel" or ""

                        local number_section = {
                            " ",
                            tab.number(),
                            " ",
                            hl = "TabLineNum" .. suffix
                        }

                        local ok, attention = pcall(vim.api.nvim_tabpage_get_var, tab.id, "attention")
                        if not ok then
                            attention = false
                        end

                        local name = tab.name()
                        local name_section = { " ", tab.name(), " ", hl = "TabLineName" .. suffix }
                        name_section = name ~= "" and name_section or {}

                        if attention then
                            local attention_section = { " ! ", hl = "TabLineNum" .. suffix }
                            return { number_section, name_section, attention_section }
                        end

                        return { number_section, name_section }
                    end,
                    { margin = " " }
                )
                return {
                    -- Tabs
                    line.spacer(),
                    tabs,
                    line.spacer(),
                }
            end,
            option = {
                tab_name = {
                    name_fallback = function(tabid)
                        local number = api.get_tab_number(tabid)
                        local dir = vim.fn.getcwd(-1, number)
                        return vim.fn.fnamemodify(dir, ":t")
                    end,
                },
            },
        })
    end
}
