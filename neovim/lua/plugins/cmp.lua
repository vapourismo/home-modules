return {
    "hrsh7th/nvim-cmp",
    dependencies = {
        "hrsh7th/cmp-nvim-lsp",
        "hrsh7th/cmp-nvim-lua",
        "hrsh7th/cmp-buffer",
        "hrsh7th/cmp-path",
        "hrsh7th/cmp-cmdline",
        "zbirenbaum/copilot.lua",
        "windwp/nvim-autopairs",
    },
    config = function()
        local cmp = require("cmp")

        local insert_keys = {
            ["<Tab>"] = {
                i = cmp.mapping.confirm({
                    select = true
                })
            },
            ["<C-j>"] = {
                i = cmp.mapping.select_next_item({
                    behavior = cmp.SelectBehavior.Select
                })
            },
            ["<C-n>"] = {
                i = cmp.mapping.select_next_item({
                    behavior = cmp.SelectBehavior.Select
                })
            },
            ["<C-k>"] = {
                i = cmp.mapping.select_prev_item({
                    behavior = cmp.SelectBehavior.Select
                })
            },
            ["<C-p>"] = {
                i = cmp.mapping.select_prev_item({
                    behavior = cmp.SelectBehavior.Select
                })
            },
        }

        cmp.setup({
            preselect = cmp.PreselectMode.None,
            mapping = insert_keys,
            sources = cmp.config.sources(
                {
                    { name = "nvim_lsp" },
                },
                {
                    { name = "buffer" },
                }
            ),
        })

        local cmd_keys = {
            ["<Tab>"] = {
                c = cmp.mapping.confirm({
                    select = true
                })
            },
            ["<C-j>"] = {
                c = cmp.mapping.select_next_item({
                    behavior = cmp.SelectBehavior.Select
                })
            },
            ["<C-n>"] = {
                c = cmp.mapping.select_next_item({
                    behavior = cmp.SelectBehavior.Select
                })
            },
            ["<C-k>"] = {
                c = cmp.mapping.select_prev_item({
                    behavior = cmp.SelectBehavior.Select
                })
            },
            ["<C-p>"] = {
                c = cmp.mapping.select_prev_item({
                    behavior = cmp.SelectBehavior.Select
                })
            },
        }

        cmp.setup.cmdline({ "/", "?" }, {
            mapping = cmd_keys,
            sources = {
                { name = "buffer" }
            }
        })

        cmp.setup.cmdline(":", {
            mapping = cmd_keys,
            sources = cmp.config.sources({
                { name = "path" }
            }, {
                { name = "cmdline" }
            }),
            matching = { disallow_symbol_nonprefix_matching = false }
        })

        local cmp_autopairs = require("nvim-autopairs.completion.cmp")
        cmp.event:on(
            "confirm_done",
            cmp_autopairs.on_confirm_done()
        )
    end,
}
