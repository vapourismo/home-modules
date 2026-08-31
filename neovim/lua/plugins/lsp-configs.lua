return {
    "neovim/nvim-lspconfig",
    config = function()
        local default_ra_before_init = vim.lsp.config["rust_analyzer"].before_init
        vim.lsp.config("rust_analyzer", {
            cmd = { "rust-analyzer" },
            cmd_env = {
                RUSTC_WRAPPER = "",
            },
            inlay_hints = { enabled = true },
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
                    },
                    procMacro = {
                        processes = 2,
                    },
                    completion = {
                        callable = {
                            snippets = "add_parentheses",
                        },
                    },
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
            on_exit = function(code, _, client_id)
                local message = ("client %d exited with code %d"):format(client_id, code)
                vim.notify(message, vim.log.levels.INFO, { title = "rust-analyzer" })
            end,
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
                    group = true,
                    env = run_args.args.environment,
                    cwd = run_args.args.cwd,
                    position = "right",
                    title = run_args.label,
                }

                require("terminals").new(cmd, opts)
            end
        end

        vim.lsp.config("oyui_ls", {
            cmd = { "oyui", "language-server" },
            filetypes = { "rune" },
            root_markers = { "config.rn" },
        })
        vim.lsp.enable("oyui_ls")

        vim.lsp.config("lua_ls", {
            settings = {
                Lua = {
                    runtime = {
                        version = 'LuaJIT'
                    },
                    workspace = {
                        checkThirdParty = false,
                        library = {
                            vim.env.VIMRUNTIME
                        }
                    }
                },
            }
        })
        vim.lsp.enable("lua_ls")

        vim.lsp.enable("nixd")
        vim.lsp.enable("taplo")
        vim.lsp.enable("ocamllsp")
        vim.lsp.enable("pylsp")
        vim.lsp.enable("gopls")
        vim.lsp.enable("openscad_lsp")
        vim.lsp.enable("typos_lsp")
        vim.lsp.enable("vtsls")
        vim.lsp.enable("svelte")
        vim.lsp.enable("tailwindcss")
        vim.lsp.enable("jsonls")
        vim.lsp.enable("just")
        vim.lsp.enable("eslint")
    end,
}
