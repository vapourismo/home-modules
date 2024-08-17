return {
	"neovim/nvim-lspconfig",
	config = function()
		local lspconfig = require("lspconfig")

		lspconfig.rust_analyzer.setup({
			inlay_hints = { enabled = true },
			settings = {
				["rust-analyzer"] = {
					check = { command = "clippy" },
					cargo = { features = "all" },
					imports = { granularity = { enforce = true } },
				}
			}
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
	end
}
