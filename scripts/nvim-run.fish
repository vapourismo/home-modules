argparse 't/title=' -- $argv
or exit 1

set opts "cwd = '$PWD'"

if set -q _flag_title
    set -a opts "title = '$_flag_title'"
end

set cmd (string escape $argv)
set opts "{" (string join ", " $opts) "}"
set lua "AllSnackTerminals:new([[$cmd]], $opts)"

nvr -c "lua $lua"
