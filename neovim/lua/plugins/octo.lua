return {
	{
		"pwntester/octo.nvim",
		cmd = "Octo",
		opts = {
			picker = "snacks",
			enable_builtin = true,
			mappings_disable_default = false,
		},
		keys = {
			{ "<Space>O", "<cmd>Octo<cr>" },
		},
		dependencies = {
			"nvim-lua/plenary.nvim",
			"folke/snacks.nvim",
			"nvim-tree/nvim-web-devicons",
		},
	}
}
