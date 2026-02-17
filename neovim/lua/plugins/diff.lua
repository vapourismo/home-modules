return {
    "esmuellert/codediff.nvim",
    dependencies = { "MunifTanjim/nui.nvim" },
    opts = {
        diff = {
            cycle_next_hunk = false,
            cycle_next_file = false,
        },
        explorer = {
            position = "bottom",
        }
    },
    cmd = "CodeDiff",
}
