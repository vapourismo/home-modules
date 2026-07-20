return {
    "vapourismo/jjwsm.nvim",
    config = false,
    keys = {
        { "<Space>ws", function() require("jjwsm").switch() end },
        { "<Space>wn", function() require("jjwsm").new() end },
        { "<Space>wd", function() require("jjwsm").delete() end },
    },
}
