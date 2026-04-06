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

                        local name = tab.name()
                        local name_section = { " ", tab.name(), " ", hl = "TabLineName" .. suffix }
                        local name_section = name ~= "" and name_section or {}

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
