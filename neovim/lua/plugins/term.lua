return
{
	"akinsho/toggleterm.nvim",
	config = function()
		local toggleterm = require("toggleterm")
		toggleterm.setup({
			start_insert = true,
			persist_mode = false,
			persist_size = false,
			float_opts = {
				border = "curved",
				title_pos = "center",
			},
			winbar = {
				name_formatter = function(term)
					return " " .. term.name .. " "
				end
			},
		})
	end,
}
