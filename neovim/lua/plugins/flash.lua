return {
    "folke/flash.nvim",
    lazy = false,
    config = function()
        local flash = require("flash")

        flash.setup({
            search = {
                multi_window = false
            }
        })

        vim.keymap.set("", "<Space>j", function()
            flash.jump({
                labels = "hjklionmasdfqwec",
                label = {
                    uppercase = false,
                    before = true,
                    after = false,
                    style = "overlay",
                },
                pattern = ".",
                search = {
                    mode = function(pattern)
                        if pattern:sub(1, 1) == "." then
                            pattern = pattern:sub(2)
                        end
                        return ([[\<%s\w*\>]]):format(pattern), ([[\<%s]]):format(pattern)
                    end,
                },
                jump = {
                    autojump = false,
                },
            })
        end)

        vim.keymap.set("", "<D-f>", function()
            flash.jump({
                labels = "hjklionmasdfqwec",
                label = {
                    uppercase = false,
                    before = true,
                    after = false,
                    style = "overlay",
                },
                pattern = ".",
                search = {
                    mode = function(pattern)
                        if pattern:sub(1, 1) == "." then
                            pattern = pattern:sub(2)
                        end
                        return ([[\<%s\w*\>]]):format(pattern), ([[\<%s]]):format(pattern)
                    end,
                },
                jump = {
                    autojump = false,
                },
            })
            vim.cmd('normal viw"py"pp')
        end)

        vim.keymap.set("", "mt", function()
            flash.treesitter({
                label = { rainbow = { enabled = true } }
            })
        end)
    end,
}
