# Exécute du SQL sur le projet Supabase via l'API de gestion. Usage : python3 scripts/supabase-sql.py <réf> <fichier.sql | -> 
# Le jeton sbp_ est ajouté par le proxy de l'environnement « work-app » : il n'est jamais dans le code.
import json, sys, urllib.request
ref, path = sys.argv[1], sys.argv[2]
sql = open(path).read() if path != '-' else sys.stdin.read()
req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{ref}/database/query',
    data=json.dumps({'query': sql}).encode(), headers={'Content-Type': 'application/json'}, method='POST')
try:
    with urllib.request.urlopen(req, timeout=120) as r:
        print(r.status, r.read().decode()[:20000])
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode()[:20000])
