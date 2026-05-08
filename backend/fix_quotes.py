import os
import glob
import re

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find double quotes around literal strings in SQL queries
    # Look for account_type = "...", fund_name = "...", status = "...", status IN ("...")
    
    # We can just look for db.execute(...) and replace "..." with '...' inside it.
    # A safer approach: find db.execute('...') and inside the single-quoted string, replace " with '
    
    def replacer(match):
        sql_string = match.group(1)
        # Replace double quotes with escaped single quotes inside the SQL string
        fixed_sql = sql_string.replace('"', "\\'")
        return f"db.execute('{fixed_sql}'"

    # Match db.execute('...')
    new_content = re.sub(r"db\.execute\('([^']+)'", replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed quotes in {filepath}")

for f in glob.glob('blueprints/*.py'):
    fix_file(f)
