return
{
	"akinsho/toggleterm.nvim",
	config = function()
		local toggleterm = require("toggleterm")
		toggleterm.setup({
			start_insert = true,
			persist_mode = false,
			persist_size = false,
		})
	end,
}
