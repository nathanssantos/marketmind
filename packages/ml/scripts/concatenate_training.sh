#!/bin/bash
set -e

DATA_DIR="$(dirname "$0")/../data"
OUTPUT_FILE="${DATA_DIR}/training_unified.csv"
TEMP_DIR="${DATA_DIR}/temp_concat"

echo "=== Training Data Concatenation Script ==="
echo "Data directory: ${DATA_DIR}"
echo ""

mkdir -p "${TEMP_DIR}"

INTERVALS=("1w" "1d" "4h" "1h" "30m" "15m" "5m" "1m")
TOTAL_LINES=0
FILES_FOUND=0

echo "Checking available training files..."
for interval in "${INTERVALS[@]}"; do
    FILE="${DATA_DIR}/training_${interval}.csv"
    if [[ -f "$FILE" ]]; then
        LINES=$(wc -l < "$FILE" | tr -d ' ')
        SIZE=$(du -h "$FILE" | cut -f1)
        echo "  ✓ training_${interval}.csv: ${LINES} lines (${SIZE})"
        TOTAL_LINES=$((TOTAL_LINES + LINES - 1))
        FILES_FOUND=$((FILES_FOUND + 1))
    else
        echo "  ✗ training_${interval}.csv: NOT FOUND"
    fi
done

if [[ $FILES_FOUND -eq 0 ]]; then
    echo ""
    echo "ERROR: No training files found!"
    exit 1
fi

echo ""
echo "Found ${FILES_FOUND} files with ~${TOTAL_LINES} total samples"
echo ""

FIRST_FILE="${DATA_DIR}/training_1w.csv"
if [[ ! -f "$FIRST_FILE" ]]; then
    for interval in "${INTERVALS[@]}"; do
        if [[ -f "${DATA_DIR}/training_${interval}.csv" ]]; then
            FIRST_FILE="${DATA_DIR}/training_${interval}.csv"
            break
        fi
    done
fi

echo "Creating unified dataset..."
HEADER=$(head -1 "$FIRST_FILE")
echo "${HEADER},interval" > "$OUTPUT_FILE"

for interval in "${INTERVALS[@]}"; do
    FILE="${DATA_DIR}/training_${interval}.csv"
    if [[ -f "$FILE" ]]; then
        echo "  Processing ${interval}..."
        tail -n +2 "$FILE" | while IFS= read -r line; do
            echo "${line},${interval}"
        done >> "$OUTPUT_FILE"
    fi
done

FINAL_LINES=$(wc -l < "$OUTPUT_FILE" | tr -d ' ')
FINAL_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

echo ""
echo "=== Concatenation Complete ==="
echo "Output: ${OUTPUT_FILE}"
echo "Total lines: ${FINAL_LINES} (including header)"
echo "File size: ${FINAL_SIZE}"
echo ""

echo "Verifying data integrity..."
HEADER_COLS=$(head -1 "$OUTPUT_FILE" | tr ',' '\n' | wc -l | tr -d ' ')
echo "  Header columns: ${HEADER_COLS}"

SAMPLE_LINE=$(sed -n '2p' "$OUTPUT_FILE")
SAMPLE_COLS=$(echo "$SAMPLE_LINE" | tr ',' '\n' | wc -l)
echo "  Sample row columns: ${SAMPLE_COLS}"

if [[ "$HEADER_COLS" -eq "$SAMPLE_COLS" ]]; then
    echo "  ✓ Column count matches"
else
    echo "  ✗ WARNING: Column count mismatch!"
fi

echo ""
echo "Interval distribution:"
for interval in "${INTERVALS[@]}"; do
    COUNT=$(grep -c ",${interval}$" "$OUTPUT_FILE" 2>/dev/null || echo "0")
    echo "  ${interval}: ${COUNT} samples"
done

rm -rf "${TEMP_DIR}"

echo ""
echo "Done! Ready for training with:"
echo "  python scripts/train_setup_classifier.py --data ${OUTPUT_FILE} --config config.json --output models/model.onnx"
