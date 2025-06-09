return {
	"neovim/nvim-lspconfig",
	config = function()
		vim.lsp.config("rust_analyzer", {
			cmd = { "nix", "run", "--refresh", "nixpkgs#rust-analyzer", "--" },
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
				}
			},
			on_new_config = function(new_config, new_root_dir)
				local ra_config_file = io.open(new_root_dir .. "/.rust-analyzer.json", "r")
				if not ra_config_file then
					return
				end

				local ra_config = ra_config_file:read("*a")
				ra_config_file:close()
				ra_config = vim.json.decode(ra_config)

				new_config.settings["rust-analyzer"] = vim.tbl_deep_extend(
					"force",
					new_config.settings["rust-analyzer"],
					ra_config
				)
			end,
		})
		vim.lsp.enable("rust_analyzer")

		vim.lsp.config("nil_ls", {
			settings = {
				["nil"] = {
					formatting = { command = { "alejandra" } }
				}
			}
		})
		vim.lsp.enable("nil_ls")

		vim.lsp.config("buck2", {
			cmd = { "buckle", "lsp" }
		})
		vim.lsp.enable("buck2")

		vim.lsp.enable("lua_ls")
		vim.lsp.enable("taplo")
		vim.lsp.enable("ocamllsp")
		vim.lsp.enable("pylsp")
		vim.lsp.enable("gopls")
		vim.lsp.enable("openscad_lsp")
	end
}
