return {
	"folke/snacks.nvim",
	priority = 1000,
	lazy = false,
	opts = {},
	keys = {
		{ "<Space>z", function() Snacks.zen() end },
		{ "<C-;>",    function() Snacks.terminal(vim.o.shell) end, mode = { "n", "t", "v" } },
		{ "<C-\\>",   function() Snacks.terminal() end,            mode = { "n", "t", "v" } },
	},
}
