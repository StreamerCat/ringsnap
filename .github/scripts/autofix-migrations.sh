#!/bin/bash
# Migration Autofix Script - Automatically fixes common migration issues
# Usage: bash .github/scripts/autofix-migrations.sh

set -e

MIGRATIONS_DIR="supabase/migrations"
MANUAL_DIR="supabase/manual"
CHANGES_MADE=0

echo "🔧 Auto-fixing migrations in $MIGRATIONS_DIR..."
echo ""

# ==============================================================================
# FIX 1: Move invalid filenames to manual/
# ==============================================================================
echo "Checking for invalid migration filenames..."
MOVED_COUNT=0
mkdir -p "$MANUAL_DIR"

for migration in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$migration" ] || continue
  filename=$(basename "$migration")
  
  # Skip debug/test migrations (99999...)
  if [[ "$filename" =~ ^99999 ]]; then
    continue
  fi
  
  # Check if filename matches required format
  if ! [[ "$filename" =~ ^[0-9]{14}_.+\.sql$ ]]; then
    echo "  ⚠️  Moving invalid filename: $filename → manual/"
    mv "$migration" "$MANUAL_DIR/"
    MOVED_COUNT=$((MOVED_COUNT + 1))
    CHANGES_MADE=1
  fi
done

if [ $MOVED_COUNT -eq 0 ]; then
  echo "  ✅ No invalid filenames found"
else
  echo "  ✅ Moved $MOVED_COUNT invalid files to manual/"
fi
echo ""

# ==============================================================================
# FIX 2: Resolve duplicate timestamp prefixes
# ==============================================================================
echo "Checking for duplicate migration version prefixes..."
RENAMED_COUNT=0

cd "$MIGRATIONS_DIR"
DUPLICATES=$(ls -1 *.sql 2>/dev/null | grep -v "^99999" | cut -c1-14 | sort | uniq -d || true)
cd - > /dev/null

if [ -n "$DUPLICATES" ]; then
  echo "$DUPLICATES" | while read dup; do
    FILES=($MIGRATIONS_DIR/${dup}*.sql)
    echo "  ⚠️  Found duplicate prefix: $dup (${#FILES[@]} files)"
    
    # Keep first file, rename the rest
    for ((i=1; i<${#FILES[@]}; i++)); do
      old_file="${FILES[$i]}"
      old_name=$(basename "$old_file")
      
      # Increment timestamp by 1 second until unique
      new_timestamp="$dup"
      new_name="${old_name}"
      increment=1
      
      while [ -f "$MIGRATIONS_DIR/${new_timestamp}${old_name:14}" ]; do
        # Parse timestamp and increment
        year=${new_timestamp:0:4}
        month=${new_timestamp:4:2}
        day=${new_timestamp:6:2}
        hour=${new_timestamp:8:2}
        min=${new_timestamp:10:2}
        sec=${new_timestamp:12:2}
        
        # Increment second
        new_sec=$((10#$sec + increment))
        if [ $new_sec -ge 60 ]; then
          new_sec=$((new_sec - 60))
          new_min=$((10#$min + 1))
          if [ $new_min -ge 60 ]; then
            new_min=$((new_min - 60))
            new_hour=$((10#$hour + 1))
            if [ $new_hour -ge 24 ]; then
              # Just add more seconds instead of day overflow
              new_sec=$((10#$sec + increment))
            fi
          fi
        fi
        
        new_timestamp=$(printf "%04d%02d%02d%02d%02d%02d" $year $month $day ${new_hour:-$hour} ${new_min:-$min} $new_sec)
        increment=$((increment + 1))
      done
      
      new_name="${new_timestamp}${old_name:14}"
      new_file="$MIGRATIONS_DIR/$new_name"
      
      echo "    → Renaming: $old_name → $new_name"
      mv "$old_file" "$new_file"
      RENAMED_COUNT=$((RENAMED_COUNT + 1))
      CHANGES_MADE=1
    done
  done
fi

if [ $RENAMED_COUNT -eq 0 ]; then
  echo "  ✅ No duplicate prefixes found"
else
  echo "  ✅ Renamed $RENAMED_COUNT files to resolve duplicates"
fi
echo ""

# ==============================================================================
# FIX 3: Replace COMMENT ON string concatenation
# ==============================================================================
echo "Checking for COMMENT ON with string concatenation..."
FIXED_COMMENTS=0

for migration in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$migration" ] || continue
  
  if grep -q "COMMENT ON.*||" "$migration" 2>/dev/null; then
    echo "  ⚠️  Found COMMENT concatenation in $(basename "$migration")"
    # Comment out the line (simple fix)
    sed -i 's/^\(.*COMMENT ON.*||.*\)$/-- AUTOFIX: Commented out invalid concatenation\n-- \1/' "$migration"
    FIXED_COMMENTS=$((FIXED_COMMENTS + 1))
    CHANGES_MADE=1
  fi
done

if [ $FIXED_COMMENTS -eq 0 ]; then
  echo "  ✅ No COMMENT concatenation found"
else
  echo "  ✅ Fixed $FIXED_COMMENTS COMMENT statements"
fi
echo ""

# ==============================================================================
# FIX 4: Comment out invalid sequence grants on UUID tables
# ==============================================================================
echo "Checking for invalid sequence grants on UUID tables..."
FIXED_GRANTS=0

for migration in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$migration" ] || continue
  
  if grep -q "DEFAULT gen_random_uuid()" "$migration" 2>/dev/null; then
    if grep -q "GRANT USAGE ON SEQUENCE.*_id_seq" "$migration" 2>/dev/null; then
      if ! grep "GRANT USAGE ON SEQUENCE.*_id_seq" "$migration" | grep -q "^--" 2>/dev/null; then
        echo "  ⚠️  Found invalid sequence grant in $(basename "$migration")"
        # Comment out the GRANT line
        sed -i 's/^\(.*GRANT USAGE ON SEQUENCE.*_id_seq.*\)$/-- AUTOFIX: UUID PKs do not create sequences\n-- \1/' "$migration"
        FIXED_GRANTS=$((FIXED_GRANTS + 1))
        CHANGES_MADE=1
      fi
    fi
  fi
done

if [ $FIXED_GRANTS -eq 0 ]; then
  echo "  ✅ No invalid sequence grants found"
else
  echo "  ✅ Fixed $FIXED_GRANTS invalid sequence grants"
fi
echo ""

# ==============================================================================
# FIX 5: Remove STABLE functions from CREATE INDEX predicates
# ==============================================================================
echo "Checking for CREATE INDEX with STABLE functions in WHERE clause..."
FIXED_INDEXES=0

for migration in "$MIGRATIONS_DIR"/*.sql; do
  [ -f "$migration" ] || continue
  
  # Check if file has CREATE INDEX with WHERE and now()
  if grep -i "CREATE.*INDEX" "$migration" | grep -i "WHERE" | grep -iE "now\(\)|current_timestamp|current_date|current_time" > /dev/null 2>&1; then
    echo "  ⚠️  Found STABLE function in index predicate in $(basename "$migration")"
    # Comment out the WHERE clause (convert to plain index)
    # This is a simple approach - comment out lines with WHERE and STABLE functions
    sed -i '/CREATE.*INDEX/,/;/ { /WHERE.*\(now()\|current_timestamp\|current_date\|current_time\)/s/WHERE.*/-- AUTOFIX: Removed STABLE function from index predicate\n  ;/ }' "$migration"
    FIXED_INDEXES=$((FIXED_INDEXES + 1))
    CHANGES_MADE=1
  fi
done

if [ $FIXED_INDEXES -eq 0 ]; then
  echo "  ✅ No STABLE functions in index predicates found"
else
  echo "  ✅ Fixed $FIXED_INDEXES index predicates"
fi
echo ""

# ==============================================================================
# Summary
# ==============================================================================
if [ $CHANGES_MADE -eq 1 ]; then
  echo "✅ Autofix completed with changes"
  exit 0
else
  echo "✅ Autofix completed - no changes needed"
  exit 0
fi
