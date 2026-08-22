return {
    "vapourismo/terminals.nvim",
    dir = "~/Workspaces/terminals.nvim",
    dependencies = {
        {
            "vapourismo/snacks.nvim",
            opts = {
                styles = {
                    terminal = {
                        max_width = 220,
                        wo = {
                            foldmethod = "manual",
                            foldtext = "foldtext()",
                        },
                        keys = {
                            q = false,
                            term_normal = {
                                "<esc>",
                                function(this)
                                    local win_opts = this.opts and this.opts.w
                                    if win_opts and win_opts.ole_captive then
                                        return "<esc>"
                                    else
                                        vim.cmd("stopinsert")
                                    end
                                end,
                                mode = "t",
                                expr = true,
                            },
                        },
                    }
                }
            },
            keys = {
                {
                    "<Esc>",
                    "<C-\\><C-n>",
                    mode = { "t" },
                    remap = false
                },
                {
                    "<S-Esc>",
                    function()
                        local channel = vim.bo.channel
                        if channel > 0 then
                            vim.api.nvim_chan_send(channel, "\x1b")
                        end
                    end,
                    mode = { "t" },
                    silent = true,
                    desc = "Send literal Escape to terminal",
                },
            },
        }
    },
    opts = {},
    keys = {
        {
            "<D-§>",
            function()
                require("terminals").toggle({ position = "float" })
            end,
            mode = { "n", "t", "v", "i" }
        },
        {
            "<D-S-R>",
            function()
                vim.ui.input(
                    {
                        prompt = "Command",
                        completion = "shellcmd",
                    },
                    function(cmd)
                        if cmd == "" or cmd == nil then
                            return
                        end

                        local term = require("terminals")
                        local info = term.current()
                        term.new(cmd, { position = info and info.position or "right" })
                    end
                )
            end,
            mode = { "n", "t", "v", "i" }
        },
        {
            "<D-r>",
            function()
                require("terminals").toggle({ position = "right" })
            end,
            mode = { "n", "v", "i", "t" }
        },
        {
            "<D->>",
            function()
                require("terminals").send({ position = "right" })
            end,
            mode = { "v" }
        },
    },
}
