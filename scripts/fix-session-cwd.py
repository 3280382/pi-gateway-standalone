#!/usr/bin/env python3
"""Fix wrong cwd in session JSONL files and delete files with missing headers."""
import json, os, sys

SESSIONS_ROOT = "/root/.pi/agent/sessions"

# Directory name to correct cwd mapping
DIR_TO_CWD = {
    "--root--": "/root",
    "--tmp--": "/tmp",
    "--root-flutter--": "/root/flutter",
    "--root-pibeter--": "/root/pibeter",
}

fixed = 0
deleted = 0
errors = 0

for dirname, expected_cwd in DIR_TO_CWD.items():
    dirpath = os.path.join(SESSIONS_ROOT, dirname)
    if not os.path.isdir(dirpath):
        continue
    
    for fname in os.listdir(dirpath):
        if not fname.endswith(".jsonl"):
            continue
        fpath = os.path.join(dirpath, fname)
        
        try:
            with open(fpath, "r") as f:
                lines = f.readlines()
            
            if not lines:
                continue
            
            header = json.loads(lines[0])
            cwd = header.get("cwd")
            
            # Missing header → delete
            if header.get("type") != "session" or not cwd:
                print(f"🗑  DELETE (no header): {fname[:60]}")
                os.remove(fpath)
                deleted += 1
                continue
            
            # Wrong cwd → fix
            if cwd != expected_cwd:
                old = cwd
                header["cwd"] = expected_cwd
                lines[0] = json.dumps(header, ensure_ascii=False) + "\n"
                
                # Write back
                with open(fpath, "w") as f:
                    f.writelines(lines)
                
                print(f"✅ {dirname}/{fname[:50]}: {old} → {expected_cwd}")
                fixed += 1
        
        except Exception as e:
            print(f"❌ ERROR {fname[:60]}: {e}")
            errors += 1

print(f"\nDone. Fixed={fixed} Deleted={deleted} Errors={errors}")
