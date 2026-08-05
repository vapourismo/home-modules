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

set last_message (mktemp)

jj wrun $rev codex $argv
