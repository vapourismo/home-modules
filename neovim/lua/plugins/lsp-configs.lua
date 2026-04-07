return {
    "neovim/nvim-lspconfig",
    config = function()
        local default_ra_before_init = vim.lsp.config["rust_analyzer"].before_init
        local default_ra_on_attach = vim.lsp.config["rust_analyzer"].on_attach
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

                return default_ra_before_init(params, config)
            end,
            on_attach = function(client, buffnr)
                vim.lsp.codelens.enable(true, { client_id = client.id })
                return default_ra_on_attach(client, buffnr)
            end
        })
        vim.lsp.enable("rust_analyzer")

        vim.lsp.commands["rust-analyzer.runSingle"] = function(command)
            for _, run_args in ipairs(command.arguments) do
                local cmd_list = { "cargo", unpack(run_args.args.cargoArgs) }

                if run_args.args.executableArgs and #run_args.args.executableArgs > 0 then
                    vim.list_extend(cmd_list, { "--", unpack(run_args.args.executableArgs) })
                end

                local cmd = table.concat(cmd_list, " ")
                local opts = {
                    env = run_args.args.environment,
                    cwd = run_args.args.cwd,
                    title = run_args.label,
                }

                AllSnackTerminals:new(cmd, opts)
            end
        end

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
        vim.lsp.enable("vtsls")
        vim.lsp.enable("svelte")
        vim.lsp.enable("jsonls")
    end,
}
