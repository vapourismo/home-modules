return {
    "neovim/nvim-lspconfig",
    config = function()
        local default_ra_before_init = vim.lsp.config["rust_analyzer"].before_init
        vim.lsp.config("rust_analyzer", {
            cmd = { "rust-analyzer" },
            inlay_hints = { enabled = true },
            capabilities = {
                textDocument = {
                    completion = {
                        completionItem = {
                            snippetSupport = false
                        }
                    }
                }
            },
            settings = {
                ["rust-analyzer"] = {
                    check = { command = "clippy" },
                    imports = { granularity = { enforce = true } },
                    cargo = { targetDir = true },
                    workspace = {
                        symbol = {
                            search = {
                                kind = "all_symbols",
                                limit = 512,
                            }
                        }
                    },
                    lens = {
                        implementations = {
                            enable = false
                        },
                        references = {
                            adt = {
                                enable = false
                            },
                            enumVariant = {
                                enable = false
                            },
                            method = {
                                enable = false
                            },
                            trait = {
                                enable = false
                            }
                        },
                    }
                }
            },
            before_init = function(params, config)
                local ra_config_path = config.root_dir .. "/.rust-analyzer.json"
                local ra_config_file = io.open(ra_config_path, "r")
                if not ra_config_file then
                    vim.notify(
                        "Using default rust-analyzer config (" ..
                        ra_config_path .. " not found)",
                        vim.log.levels.INFO
                    )

                    return
                end

                local ra_config = ra_config_file:read("*a")
                ra_config_file:close()
                ra_config = vim.json.decode(ra_config)

                vim.notify(
                    "Using additional rust-analyzer config from " .. ra_config_path,
                    vim.log.levels.INFO
                )

                config.settings["rust-analyzer"] = vim.tbl_deep_extend(
                    "force",
                    config.settings["rust-analyzer"],
                    ra_config
                )

                default_ra_before_init(params, config)
            end,
        })
        vim.lsp.enable("rust_analyzer")

        -- vim.lsp.config("nil_ls", {
        -- 	settings = {
        -- 		["nil"] = {
        -- 			formatting = { command = { "nixfmt" } }
        -- 		}
        -- 	}
        -- })
        -- vim.lsp.enable("nil_ls")

        vim.lsp.config("buck2", {
            cmd = { "buckle", "lsp" }
        })
        vim.lsp.enable("buck2")

        vim.lsp.enable("nixd")
        vim.lsp.enable("lua_ls")
        vim.lsp.enable("taplo")
        vim.lsp.enable("ocamllsp")
        vim.lsp.enable("pylsp")
        vim.lsp.enable("gopls")
        vim.lsp.enable("openscad_lsp")
        vim.lsp.enable("typos_lsp")
        vim.lsp.enable("ts_ls")
        vim.lsp.enable("jsonls")
    end,
}
