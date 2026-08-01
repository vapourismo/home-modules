function clean_workspace -a ws_id ws_dir
    jj --quiet workspace update-stale || true
    jj --quiet workspace forget "$ws_id"
    rm -rf "$ws_dir"
end

set ws_dir (mktemp -d)
set ws_id workspace-run-(shuf -i 1-9999999 -n 1)

if ! set -q argv[1]
    echo "Need at least one argument"
    exit 1
end

set change_id $argv[1]
set -e argv[1]

mkdir -p $ws_dir
jj --quiet workspace add --name $ws_id $ws_dir --revision $change_id

cd $ws_dir
trap "clean_workspace $ws_id $ws_dir" EXIT TERM KILL INT QUIT STOP

$argv
