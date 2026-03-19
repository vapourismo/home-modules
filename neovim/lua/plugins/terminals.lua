local terminals = {
    bottom = nil,
}

return {
    "folke/snacks.nvim",
    opts = {
        styles = {
            terminal = {
                wo = {
                    foldmethod = "manual",
                    foldtext = "foldtext()",
                    winbar = "",
                },
                keys = {
                    term_normal = {
                        "<esc>",
                        function(self)
                            local opts = self.opts and self.opts.w
                            if opts and opts.ole_captive then
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
            "<D-p>",
            function()
                Snacks.terminal(
                    vim.o.shell,
                    {
                        cwd = vim.fn.getcwd(-1, 0),
                        win = {
                            max_width = 220,
                            w = {
                                close_on_leave = true
                            },
                        },
                    }
                )
            end,
            mode = { "n", "t", "v", "i" }
        },
        {
            "<D-S-R>",
            function()
                Snacks.input(
                    {
                        prompt = "Command"
                    },
                    function(cmd)
                        if cmd == "" or cmd == nil then
                            return
                        end

                        Snacks.terminal(
                            cmd,
                            {
                                win = {
                                    position = "bottom",
                                }
                            }
                        )
                    end
                )
            end,
            mode = { "n", "t", "v", "i" }
        },
        {
            "<D-§>",
            function()
                if terminals.bottom
                    and not terminals.bottom.closed
                    and terminals.bottom.win ~= vim.api.nvim_get_current_win()
                then
                    terminals.bottom:focus()
                    return
                end

                terminals.bottom = Snacks.terminal(nil,
                    {
                        cwd = vim.fn.getcwd(-1, 0),
                        win = {
                            max_height = 30,
                        },
                    }
                )
            end,
            mode = { "n", "t", "v", "i" }
        },
    },
}
