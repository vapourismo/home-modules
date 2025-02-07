return {
	"nanozuki/tabby.nvim",
	config = function()
		local tabby = require("tabby")
		local api = require("tabby.module.api")
		tabby.setup({
			line = function(line)
				local tabs = line.tabs().foreach(function(tab)
					local style = tab.is_current() and "TabLineSel" or "TabLine"
					return {
						line.sep("", style, "TabLineFill"),
						tab.number(),
						tab.name(),
						line.sep("", style, "TabLineFill"),
						hl = style,
						margin = " ",
					}
				end)
				return {
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
