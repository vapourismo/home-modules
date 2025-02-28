return {
	"folke/snacks.nvim",
	priority = 1000,
	lazy = false,
	opts = {},
	keys = {
		{ "<Space>z", function() Snacks.zen() end },
	},
}
