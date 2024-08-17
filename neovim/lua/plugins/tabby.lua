return {
	"nanozuki/tabby.nvim",
	opts = {
		line = function(line)
			local tabs = line.tabs().foreach(function(tab)
				local style = tab.is_current() and "TabLineSel" or "TabLine"

				return {
					line.sep("", style, "TabLineFill"),
					tab.number(),
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
		end
	}
}
