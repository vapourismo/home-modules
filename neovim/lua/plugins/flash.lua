return {
	"folke/flash.nvim",
	lazy = false,
	config = function()
		local flash = require("flash")

		flash.setup({
			search = {
				multi_window = false
			}
		})

		vim.keymap.set("", "<Space>j", function()
			flash.jump({
				pattern = "",
				search = {
					mode = function(pattern)
						return ([[\<%s\w*\>]]):format(pattern),
						    ([[\<%s]]):format(pattern)
					end,
				},
				jump = {
					autojump = true,
				},
				label = {
					uppercase = false,
					before = true,
					after = false,
					style = "overlay",
				},
			})
		end)

		vim.keymap.set("", "mt", function()
			flash.treesitter({
				label = { rainbow = { enabled = true } }
			})
		end)
	end,
}
