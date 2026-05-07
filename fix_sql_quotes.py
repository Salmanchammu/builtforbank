"""
Fix PostgreSQL SQL quoting: replace "active" (double-quoted SQL string literals)
with 'active' (single-quoted, which PostgreSQL requires).

Strategy: For lines containing SQL queries with status = "value",
change the Python string delimiter from single quotes to double quotes,
then use single quotes for the SQL string value.
"""
import os
import re
import glob

backend_dir = 'backend'
fixed_count = 0

# Values that appear as double-quoted SQL string literals
sql_values = ['active', 'pending', 'rejected', 'frozen', 'blocked', 
              'inactive', 'closed', 'completed', 'approved', 'cancelled',
              'suspended', 'unknown']

for pyfile in glob.glob(os.path.join(backend_dir, '**', '*.py'), recursive=True):
    with open(pyfile, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    modified = False
    new_lines = []
    
    for i, line in enumerate(lines):
        original_line = line
        
        # Only fix lines that contain SQL-like patterns with double-quoted values
        # Pattern: status = "active" or status="active" inside a db.execute() call
        if 'db.execute' in line or '.execute(' in line or 'INSERT' in line or 'UPDATE' in line or 'SELECT' in line:
            for val in sql_values:
                dq_pattern = f'"{val}"'
                sq_pattern = f"'{val}'"
                if dq_pattern in line:
                    # Check if this line's string is single-quoted (common pattern)
                    # Replace the double-quoted SQL value with escaped single quotes
                    # e.g., 'WHERE status = "active"' -> "WHERE status = 'active'"
                    # But we need to be careful not to break the Python string
                    
                    # Simple approach: if the SQL string uses single quotes as delimiter,
                    # switch to using escaped backslash quotes
                    line = line.replace(dq_pattern, f"\\'{val}\\'")
                    modified = True
        
        new_lines.append(line)
    
    if modified:
        with open(pyfile, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        fixed_count += 1
        print(f"Fixed: {os.path.basename(pyfile)}")

print(f"\nTotal files fixed: {fixed_count}")
