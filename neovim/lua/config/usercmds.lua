-- Direnv Support
vim.api.nvim_create_user_command("DirenvLoad", function()
    local notification
    local notification_title = "Direnv"

    local function notify(msg, level)
        notification = vim.notify(msg, level, { title = notification_title, replace = notification })
    end

    notify("Loading direnv ...", vim.log.levels.INFO)
    vim.system(
        { "direnv", "exec", "/", "direnv", "export", "json" },
        {
            env = { NVIM_DIRLOAD = "1" },
            text = true
        },
        vim.schedule_wrap(function(result)
            if result.code ~= 0 then
                notify("Failed to load direnv:\n" .. result.stderr, vim.log.levels.ERROR)
                return
            end

            if not result.stdout or result.stdout == "" then
                notify("No direnv set up", vim.log.levels.ERROR)
                return
            end

            local env = vim.fn.json_decode(result.stdout)
            for key, value in pairs(env) do
                vim.env[key] = value
            end

            notify("Loaded direnv variables", vim.log.levels.INFO)
        end)
    )
end, {})
