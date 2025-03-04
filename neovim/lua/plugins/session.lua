return {
	"folke/persistence.nvim",
	event = "BufReadPre",
	opts = {
		branch = false
	},
	keys = {
		{ "<Space>F", function() require("persistence").select() end },
	},
}
