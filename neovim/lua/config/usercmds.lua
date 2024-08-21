-- Session management
local session_file = vim.g.neovide and "~/.neovide-last-session" or "~/.nvim-last-session"

vim.api.nvim_create_user_command("SaveSession", function()
	vim.cmd.ScopeSaveState()
	vim.cmd.mksession({ session_file, bang = true })
end, {})

vim.api.nvim_create_user_command("LoadLastSession", function()
	vim.cmd.source(session_file)
	vim.cmd.ScopeLoadState()
end, {})

-- Direnv Support
vim.api.nvim_create_user_command("DirenvLoad", function()
	vim.system(
		{ "direnv", "exec", "/", "direnv", "export", "json" },
		{ text = true },
		vim.schedule_wrap(function(result)
			if result.code ~= 0 then
				vim.notify("Failed to load direnv:\n" .. result.stderr, vim.log.levels.ERROR)
				return
			end

			local env = vim.fn.json_decode(result.stdout)
			for key, value in pairs(env) do
				vim.env[key] = value
			end

			vim.notify("Loaded direnv variables", vim.log.levels.INFO)
		end)
	)
end, {})
