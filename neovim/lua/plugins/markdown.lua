return {
	"MeanderingProgrammer/render-markdown.nvim",
	dependencies = {
		"nvim-treesitter/nvim-treesitter"
	},
	ft = { "Avante", "markdown" },
	opts = {
		file_types = { "Avante", "markdown" },
		heading = {
			sign = false,
			position = "overlay",
			icons = { "█ ", "██ ", "███ ", "████ ", "█████ ", "██████ " },
			width = "full",
		},
		code = {
			sign = false,
			style = "normal",
		},
		checkbox = {
			unchecked = {
				icon = "",
			},
			checked = {
				icon = "",
			},
		},
		quote = {
			icon = "▏",
		},
		pipe_table = {
			style = "normal",
		}
	},
}
