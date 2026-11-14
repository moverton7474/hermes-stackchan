import json, sys, urllib.request, re, os, glob
tok = re.search(r'sbp_[a-f0-9]+', open(os.path.expanduser("~/Dropbox/Finanicals/Milton & Lisa Overton Financials/GF Accelerate LLC/AI Interactive Vision Board/API Keys/New Supabase Access Token 4 17 2026.txt")).read()).group(0)
def q(sql):
    r = urllib.request.Request('https://api.supabase.com/v1/projects/edaigbnnofyxcfbpcvct/database/query',
        data=json.dumps({'query': sql}).encode(), headers={'Authorization':'Bearer '+tok,'Content-Type':'application/json','User-Agent':'supabase-cli/2'})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return {'error': e.code, 'body': e.read().decode()[:300]}
if __name__ == '__main__':
    for f in sys.argv[1:]:
        res = q(open(f).read())
        print(f, 'ok' if isinstance(res, list) else res)
