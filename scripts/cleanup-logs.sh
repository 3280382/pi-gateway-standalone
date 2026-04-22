#!/bin/bash
# Log cleanup script
# Removes old .log files while preserving current active logs and a minimum history.
#
# Usage:
#   bash scripts/cleanup-logs.sh [keep_days] [min_files]
#
# Defaults:
#   keep_days = 7  (remove files older than 7 days)
#   min_files = 10 (keep at least 10 non-current files per directory)

set -e

KEEP_DAYS="${1:-7}"
MIN_KEEP="${2:-10}"
GATEWAY_DIR="/root/pi-gateway-standalone"
LOGS_DIR="${GATEWAY_DIR}/logs"

if [ ! -d "$LOGS_DIR" ]; then
  echo "Logs directory not found: $LOGS_DIR"
  exit 0
fi

echo "=== Log Cleanup ==="
echo "Directory: ${LOGS_DIR}"
echo "Remove .log files older than ${KEEP_DAYS} days"
echo "Keep at least ${MIN_KEEP} non-current files per directory"
echo ""

total_removed=0
total_remaining=0

# Find every directory that contains .log files
while IFS= read -r dir; do
  [ -n "$dir" ] || continue

  dir_name="${dir#$LOGS_DIR/}"
  [ "$dir_name" = "$dir" ] && dir_name="(root)"

  # Count total .log files in this directory
  total_all=$(find "$dir" -maxdepth 1 -type f -name "*.log" | wc -l)

  # Gather deletable candidates: non-current files older than KEEP_DAYS
  mapfile -t candidates < <(find "$dir" -maxdepth 1 -type f -name "*.log" ! -name "*_current*" -mtime +${KEEP_DAYS} | sort)

  non_current_total=$(find "$dir" -maxdepth 1 -type f -name "*.log" ! -name "*_current*" | wc -l)

  # Determine how many we can safely remove
  if [ ${#candidates[@]} -eq 0 ]; then
    removed=0
  else
    remaining_after_remove=$((non_current_total - ${#candidates[@]}))
    if [ "$remaining_after_remove" -lt "$MIN_KEEP" ]; then
      to_remove=$((non_current_total - MIN_KEEP))
      [ "$to_remove" -lt 0 ] && to_remove=0
    else
      to_remove=${#candidates[@]}
    fi

    removed=0
    for ((i = 0; i < to_remove; i++)); do
      rm -f "${candidates[$i]}"
      removed=$((removed + 1))
    done
  fi

  remaining=$(find "$dir" -maxdepth 1 -type f -name "*.log" | wc -l)
  total_removed=$((total_removed + removed))
  total_remaining=$((total_remaining + remaining))

  if [ "$removed" -gt 0 ]; then
    echo "  ${dir_name}: ${total_all} total, ${removed} removed, ${remaining} remaining"
  fi
done < <(find "${LOGS_DIR}" -type f -name "*.log" -printf "%h\n" | sort -u)

echo ""
echo "Summary: ${total_removed} files removed, ${total_remaining} files remaining"
echo "Cleanup complete."
