#!/bin/zsh
# COURTVISION AI — local snapshot refresh.
# Runs the data pipeline and model training in a dedicated git worktree (so the working checkout is never
# touched), validates the result, and publishes it to main only if every check passes.
# NBA Stats blocks most cloud runners, which is why this runs on a Mac rather than in GitHub Actions.
#
#   scripts/refresh_snapshot.sh              full refresh, validate, commit, push
#   CV_SKIP_FETCH=1 scripts/refresh_snapshot.sh   skip the pipeline (exercise setup + validation only)
#   CV_DRY_RUN=1 scripts/refresh_snapshot.sh      do everything except commit and push
set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${CV_REFRESH_DIR:-$HOME/Library/Caches/courtvision-refresh}"
LOGDIR="$HOME/Library/Logs/courtvision"; mkdir -p "$LOGDIR"
LOG="$LOGDIR/refresh-$(date +%Y%m%d-%H%M%S).log"
PY="${CV_PYTHON:-/usr/local/bin/python3}"
LOCK="$WORK.lock"
say() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
fail() { say "FAILED: $*"; say "Nothing was published. Log: $LOG"; rmdir "$LOCK" 2>/dev/null; exit 1; }

mkdir "$LOCK" 2>/dev/null || { echo "another refresh is running ($LOCK exists)"; exit 2; }
say "refresh started · repo $REPO · worktree $WORK"

cd "$REPO" || fail "repo not found"
git fetch -q origin main || fail "git fetch failed"
if [ ! -d "$WORK/.git" ] && [ ! -f "$WORK/.git" ]; then
  git worktree prune; git worktree add -q --detach "$WORK" origin/main >>"$LOG" 2>&1 || fail "could not create worktree"
fi
cd "$WORK" || fail "worktree missing"
git checkout -q --detach origin/main >>"$LOG" 2>&1 && git reset -q --hard origin/main && git clean -qfd || fail "could not reset worktree to origin/main"
BASE=$(git rev-parse --short HEAD); say "worktree at origin/main $BASE"

if [ -z "${CV_SKIP_FETCH:-}" ]; then
  say "pipeline: teams players games lineups (about 3 hours)"
  (cd backend/pipeline && "$PY" build_snapshot.py teams players games lineups manifest) >>"$LOG" 2>&1 || fail "pipeline step failed"
  say "training models"
  (cd backend/ml && "$PY" train.py) >>"$LOG" 2>&1 || fail "model training failed"
  (cd backend/pipeline && "$PY" build_snapshot.py manifest) >>"$LOG" 2>&1 || fail "manifest step failed"
else
  say "CV_SKIP_FETCH set: pipeline skipped"
fi

say "validating snapshot"
"$PY" - >>"$LOG" 2>&1 <<'PYEOF' || fail "validation failed (see log)"
import json, os, sys, glob, subprocess
errs = []
def chk(ok, msg):
    print(("ok   " if ok else "FAIL ") + msg)
    if not ok: errs.append(msg)
for f in glob.glob('data/**/*.json', recursive=True):
    try: json.load(open(f))
    except Exception as e: errs.append(f'{f}: {e}'); print('FAIL unparsable', f)
tbl = lambda p: (lambda d: [dict(zip(d['table']['cols'], r)) for r in d['table']['rows']])(json.load(open(p)))
st = tbl('data/teams/standings.json'); chk(len(st) == 30, f'standings has 30 teams ({len(st)})')
pl = tbl('data/players/index.json'); chk(len(pl) >= 300, f'player index has {len(pl)} players (>= 300)')
att = [p['id'] for p in pl if (p['FGA'] or 0) > 0]; played = [p['id'] for p in pl if (p['GP'] or 0) > 0]
shots = {f[:-5] for f in os.listdir('data/shots')}; car = {f[:-5] for f in os.listdir('data/players/career')}
cs = sum(str(i) in shots for i in att) / max(1, len(att)); cc = sum(str(i) in car for i in played) / max(1, len(played))
chk(cs >= 0.97, f'shot coordinates cover {cs:.1%} of players with an attempt (>= 97%)')
chk(cc >= 0.97, f'career files cover {cc:.1%} of players who have appeared (>= 97%)')
deep = json.load(open('data/players/deep_ids.json')); chk(all(str(i) in shots for i in deep['shots']), 'every id in deep_ids.shots has a file')
ev = json.load(open('data/models/eval.json')); chk(ev['summary']['n_test_games'] >= 8000, f"model evaluation covers {ev['summary']['n_test_games']} test games")
chk(len(json.load(open('data/models/elo.json'))['ratings']) == 30, 'Elo has 30 teams')
for f in ['data/players/gamelogs.json', 'data/teams/gamelogs.json']:
    t = json.load(open(f))['table']; gi = t['cols'].index('GAME_ID')
    bad = sum(not str(r[gi]).zfill(10).startswith('002') for r in t['rows'])
    chk(bad == 0, f'{f} holds regular-season games only ({bad} other rows)')
# schema drift against the published snapshot
for f in ['data/players/index.json', 'data/teams/standings.json', 'data/players/gamelogs.json']:
    old = json.loads(subprocess.run(['git', 'show', f'HEAD:{f}'], capture_output=True, text=True).stdout)
    chk(old['table']['cols'] == json.load(open(f))['table']['cols'], f'columns unchanged in {f}')
# never publish a snapshot with fewer games played than the one already live
old_st = json.loads(subprocess.run(['git', 'show', 'HEAD:data/teams/standings.json'], capture_output=True, text=True).stdout)
gi = [old_st['table']['cols'].index(k) for k in ('WINS', 'LOSSES')]; old_games = sum(r[gi[0]] + r[gi[1]] for r in old_st['table']['rows'])
new_games = sum(r['WINS'] + r['LOSSES'] for r in st); chk(new_games >= old_games, f'games played did not go backwards ({old_games} -> {new_games})')
sys.exit(1 if errs else 0)
PYEOF
say "validation passed"

git add -A data backend/ml/artifacts
if git diff --cached --quiet; then say "no data changes: nothing to publish"; rmdir "$LOCK"; exit 0; fi
N=$(git diff --cached --name-only | wc -l | tr -d ' ')
if [ -n "${CV_DRY_RUN:-}" ]; then say "CV_DRY_RUN set: $N changed files not committed"; git reset -q --hard; rmdir "$LOCK"; exit 0; fi
git -c user.name="$(git -C "$REPO" config user.name)" -c user.email="$(git -C "$REPO" config user.email)" commit -q -m "data: snapshot $(date -u +%F)" || fail "commit failed"
push_main() { git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 push -q origin HEAD:main >>"$LOG" 2>&1; }
if ! push_main; then   # main moved during the run: replay the snapshot on top of it (the fresh data wins) and try once more
  say "main moved during the refresh: rebasing the snapshot onto it"
  git fetch -q origin main && git rebase -q -X theirs origin/main >>"$LOG" 2>&1 || { git rebase --abort 2>/dev/null; fail "could not rebase the snapshot onto the new main"; }
  push_main || fail "push to main failed after rebasing"
fi
say "published $(git rev-parse --short HEAD) to main ($N files) · GitHub Pages will redeploy"
rmdir "$LOCK"
