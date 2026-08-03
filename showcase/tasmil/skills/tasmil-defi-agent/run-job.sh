#!/usr/bin/env bash
# Full ACP job lifecycle runner: create -> wait budget_set -> fund -> wait deliverable -> complete/reject
# Usage: run-job.sh <provider> <offeringName> <requirementsJson> <maxFundUsd>
set -u
unset -f node npm npx nvm 2>/dev/null
export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:$PATH"
cd "$(dirname "$0")"
ACP=./node_modules/.bin/acp
PROVIDER="$1"; OFFERING="$2"; REQ="$3"; MAXFUND="${4:-0.05}"

sleep_ms() { node -e "setTimeout(()=>process.exit(0), $1)"; }
status_of() { $ACP job history --job-id "$1" --chain-id 8453 --json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('status',''))" 2>/dev/null; }

echo ">>> create-job $OFFERING @ $PROVIDER"
JOB=$($ACP client create-job --provider "$PROVIDER" --offering-name "$OFFERING" --requirements "$REQ" --chain-id 8453 --json 2>&1)
JID=$(echo "$JOB" | python3 -c "import sys,json;print(json.load(sys.stdin).get('jobId',''))" 2>/dev/null)
if [ -z "$JID" ]; then echo "create failed: $JOB"; exit 1; fi
echo ">>> jobId=$JID  waiting for budget_set…"

BUDGET=""
for i in $(seq 1 12); do
  sleep_ms 5000
  S=$(status_of "$JID")
  echo "   poll $i: $S"
  if [ "$S" = "budget_set" ] || [ "$S" = "funded" ] || [ "$S" = "submitted" ]; then
    BUDGET=$($ACP job history --job-id "$JID" --chain-id 8453 --json 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print(next((e['event'].get('amount') for e in d['entries'] if e.get('kind')=='system' and e['event'].get('type')=='budget.set'), ''))")
    break
  fi
done

if [ -z "$BUDGET" ]; then echo "!!! no budget.set — provider unresponsive. job $JID left open (expires, no cost)."; exit 2; fi
echo ">>> budget=$BUDGET USDC"
OVER=$(python3 -c "print(1 if float('$BUDGET') > float('$MAXFUND') else 0)")
if [ "$OVER" = "1" ]; then echo "!!! budget $BUDGET exceeds cap $MAXFUND — NOT funding. left open."; exit 3; fi

echo ">>> funding $BUDGET…"
$ACP client fund --job-id "$JID" --chain-id 8453 --amount "$BUDGET" --json 2>&1 | head -3

echo ">>> waiting for deliverable…"
for i in $(seq 1 10); do
  sleep_ms 5000
  S=$(status_of "$JID")
  echo "   poll $i: $S"
  if [ "$S" = "submitted" ] || [ "$S" = "completed" ]; then break; fi
done

# inspect deliverable
$ACP job history --job-id "$JID" --chain-id 8453 --json 2>/dev/null > /tmp/deliv_$JID.json
ERR=$(python3 -c "
import json
d=json.load(open('/tmp/deliv_$JID.json'))
msgs=[e for e in d['entries'] if e.get('kind')=='message' and e.get('from','').lower()=='$PROVIDER'.lower()]
last=msgs[-1]['content'] if msgs else ''
print('ERR' if 'execution failed' in last or 'internal_error' in last else 'OK')
")
if [ "$ERR" = "ERR" ]; then
  echo "!!! provider execution error — rejecting to reclaim escrow"
  $ACP client reject --job-id "$JID" --chain-id 8453 --reason "provider execution error" --json 2>&1 | head -2
  echo "$JID REJECTED"
else
  echo ">>> deliverable OK — completing"
  $ACP client complete --job-id "$JID" --chain-id 8453 --reason "delivered" --json 2>&1 | head -2
  echo "=== DELIVERABLE ==="
  python3 -c "
import json
d=json.load(open('/tmp/deliv_$JID.json'))
for e in d['entries']:
    if e.get('kind')=='message' and e.get('from','').lower()=='$PROVIDER'.lower():
        c=e.get('content','')
        try: print(json.dumps(json.loads(c),indent=2)[:2500])
        except: print(c[:2500])
"
fi
echo "JOB $JID DONE"
