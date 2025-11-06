return {
	"zbirenbaum/copilot.lua",
	cmd = "Copilot",
	event = "InsertEnter",
	opts = {
		suggestion = {
			enabled = true,
			auto_trigger = true,
			keymap = {
				accept_word = "<M-S-L>",
				accept_line = "<M-S-J>",
			},
		},
		panel = { enabled = false },
	}
}
