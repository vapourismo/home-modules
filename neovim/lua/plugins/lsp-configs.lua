return {
	"neovim/nvim-lspconfig",
	config = function()
		local lspconfig = require("lspconfig")

		lspconfig.rust_analyzer.setup({
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
		lspconfig.lua_ls.setup({})
		lspconfig.nil_ls.setup({
			settings = {
				["nil"] = {
					formatting = { command = { "alejandra" } }
				}
			}
		})
		lspconfig.taplo.setup({})
		lspconfig.ocamllsp.setup({})
		lspconfig.pylsp.setup({})
		lspconfig.gopls.setup({})
		lspconfig.openscad_lsp.setup({})
		lspconfig.buck2.setup({
			cmd = { vim.fn.expand("$HOME/.cargo/bin/buck2"), "lsp" }
		})
	end
}
