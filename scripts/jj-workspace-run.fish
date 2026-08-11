argparse 'r=' 'n=' -- $argv
or exit

set ws_dir (mktemp -d)
set ws_id wrun-(shuf -i 1-9999999 -n 1)
set rev "@-"

if set -q _flag_r
    set rev $_flag_r
end

if set -q _flag_n
    set ws_id $_flag_n
end

mkdir -p $ws_dir
jj --quiet workspace add --name $ws_id $ws_dir --revision $rev

function clean_workspace --on-event fish_exit
    if test -d "$ws_dir"
        cd "$ws_dir"
        jj --quiet workspace update-stale || true
        jj --quiet workspace forget "$ws_id"
        cd -
        rm -rf "$ws_dir"
    end
end

cd $ws_dir
$argv
