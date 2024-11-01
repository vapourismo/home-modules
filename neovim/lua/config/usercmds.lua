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

vim.api.nvim_create_user_command("PickJJ", function()
	local jj_proc = io.popen(
		[[jj log -r 'summary()' --no-graph -T 'change_id.shortest() ++ ":\t" ++ if(description, description.first_line(), label(if(empty, "empty"), description_placeholder)) ++ "\n"']]
	)

	if jj_proc == nil then
		vim.notify("Failed to run Jujutsu", vim.log.levels.ERROR)
		return
	end

	local options = {}
	for line in jj_proc:lines() do
		local colon_start, _ = string.find(line, ":")

		if colon_start ~= nil then
			local id = string.sub(line, 0, colon_start - 1)
			table.insert(options, { id = id, message = line })
		end
	end
	jj_proc:close()

	vim.ui.select(
		options,
		{
			format_item = function(item)
				return item.message
			end
		},
		function(choice)
			if choice ~= nil then
				vim.paste({ choice.id }, -1)
				vim.cmd.startinsert()
			end
		end)
end, {})
