return {
	"MeanderingProgrammer/render-markdown.nvim",
	dependencies = {
		"nvim-treesitter/nvim-treesitter"
	},
	ft = { "Avante", "markdown" },
	opts = {
		file_types = { "Avante", "markdown" },
		heading = {
			position = "inline",
		},
	},
}
