set rev "@-"

argparse 'r=' -- $argv
or exit

if set -q _flag_r
    set rev $_flag_r
end

if ! jj log -r $rev 2>/dev/null >/dev/null
    echo "Revision $rev does not exist."
    exit 1
end

set name opencode-(shuf -i 1-9999999 -n 1)

jj wrun -r $rev -n $name -- opencode $argv
