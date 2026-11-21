# Usage: fetch GET /v1/projects/edaigbnnofyxcfbpcvct/functions to fns.json, then from ~/ai-coach-review:
#   python ~/hermes-stackchan/scripts/verify_edge_functions_live.py fns.json
# Flags any edge function whose deploy time is older than the last commit touching it or its imports.
import json, subprocess, os, datetime, re, sys
fns = {f['slug']: f for f in json.load(open(sys.argv[1]))}
names = ['tutor-weekly-report', 'tutor-bible-studies', 'tutor-flashcard-mode', 'tutor-quiz-generate', 'tutor-parse-document',
         'tutor-lms-import', 'amie-prompt-builder', 'voice-coach-session', 'agent-chat', 'gemini-live-session', 'knowledge-query',
         'knowledge-ingest', 'tutor-realtime-session', 'tutor-vision-read', 'tutor-robot-session', 'tutor-data',
         'tutor-student-model', 'tutor-homework-help']
SH = 'supabase/functions/_shared/'

def deps(path, seen):
    if path in seen or not os.path.exists(path):
        return
    seen.add(path)
    src = open(path, encoding='utf-8').read()
    base = os.path.dirname(path)
    for rel in re.findall(r"from\s+['\"](\.{1,2}/[^'\"]+\.ts)['\"]", src):
        deps(os.path.normpath(os.path.join(base, rel)).replace('\\', '/'), seen)

bad = 0
for n in names:
    f = fns.get(n)
    if not f:
        print('MISSING ', n); bad += 1; continue
    dep = datetime.datetime.fromtimestamp(f['updated_at'] / 1000, datetime.timezone.utc)
    seen = set()
    for p in os.listdir(f'supabase/functions/{n}'):
        if p.endswith('.ts'):
            deps(f'supabase/functions/{n}/{p}', seen)
    out = subprocess.run(['git', 'log', '-1', '--format=%cI %h', '--'] + sorted(seen), capture_output=True, text=True).stdout.strip()
    ct = datetime.datetime.fromisoformat(out.split()[0]).astimezone(datetime.timezone.utc)
    ok = dep >= ct
    bad += (not ok)
    print(('LIVE=HEAD' if ok else 'STALE    '), f"{n:24} deployed {dep:%m-%d %H:%M}Z v{f['version']:<4} code {ct:%m-%d %H:%M}Z {out.split()[1]} ({len(seen)} files)")
print('STALE COUNT', bad)
