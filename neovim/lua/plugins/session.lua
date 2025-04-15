return {
	"folke/persistence.nvim",
	event = "BufReadPre",
	opts = {
		branch = false,
		need = 0,
	},
	keys = {
		{ "<Space>F", function() require("persistence").select() end },
	},
}
