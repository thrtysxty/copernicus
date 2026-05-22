#!/bin/bash
LOG=/tmp/qwopus_relay.log
echo "[$(date -u +%H:%M:%S)] Relay started — monitoring for chunk completions" > $LOG

for CHUNK in 2 3 4 5 6; do
  PREV=$((CHUNK - 1))
  echo "[$(date -u +%H:%M:%S)] Waiting for CHUNK $PREV COMPLETE..." >> $LOG
  
  # Poll until we see the completion signal
  WAITED=0
  while true; do
    PANE=$(tmux capture-pane -t agents:0.1 -p -S -20 2>/dev/null)
    if echo "$PANE" | grep -q "CHUNK $PREV COMPLETE"; then
      echo "[$(date -u +%H:%M:%S)] CHUNK $PREV COMPLETE detected — dispatching chunk $CHUNK" >> $LOG
      tmux send-keys -t agents:0.1 "Read and follow the instructions in /tmp/qwopus_chunk${CHUNK}.md" Enter
      echo "[$(date -u +%H:%M:%S)] Chunk $CHUNK dispatched" >> $LOG
      break
    fi
    sleep 10
    WAITED=$((WAITED + 10))
    if [ $WAITED -ge 600 ]; then
      echo "[$(date -u +%H:%M:%S)] TIMEOUT waiting for chunk $PREV — aborting relay" >> $LOG
      exit 1
    fi
  done
  
  # Small gap between detecting completion and the next check cycle
  sleep 5
done

echo "[$(date -u +%H:%M:%S)] All chunks dispatched — waiting for CHUNK 6 COMPLETE" >> $LOG
WAITED=0
while true; do
  PANE=$(tmux capture-pane -t agents:0.1 -p -S -20 2>/dev/null)
  if echo "$PANE" | grep -q "CHUNK 6 COMPLETE"; then
    LINES=$(wc -l < /Users/dadmin/Projects/copernicus-test-plan.md 2>/dev/null || echo "?")
    echo "[$(date -u +%H:%M:%S)] CHUNK 6 COMPLETE — plan written. File: $LINES lines" >> $LOG
    break
  fi
  sleep 10
  WAITED=$((WAITED + 10))
  if [ $WAITED -ge 600 ]; then
    echo "[$(date -u +%H:%M:%S)] TIMEOUT waiting for chunk 6" >> $LOG
    exit 1
  fi
done
