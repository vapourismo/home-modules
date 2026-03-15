return {
    {
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
            should_attach = function(_, bufname)
                if string.match(bufname, "env") then
                    return false
                end

                return true
            end,
        }
    },
}
