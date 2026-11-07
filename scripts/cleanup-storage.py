# Supprime proprement (via l'API de stockage) les fichiers photo d'un dossier d'entreprise.
# Usage : python3 scripts/cleanup-storage.py <réf> <company_id> [<company_id> ...]
#         python3 scripts/cleanup-storage.py <réf> --paths <chemin> [<chemin> ...]   (fichiers précis)
# Sert uniquement au nettoyage des tests. La clé d'administration du projet est lue à la volée
# via l'API de gestion (jeton sbp_ injecté par le proxy) : elle n'est ni affichée ni enregistrée.
import json, sys, urllib.request

ref, companies = sys.argv[1], sys.argv[2:]
paths = []
if companies[:1] == ['--paths']:
    paths, companies = companies[1:], []
if not companies and not paths:
    sys.exit(0)

def call(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json', **(headers or {})}, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or 'null')

keys = call(f'https://api.supabase.com/v1/projects/{ref}/api-keys?reveal=true')
secret = next((k['api_key'] for k in keys if k.get('type') == 'secret'), None) or \
         next((k['api_key'] for k in keys if k.get('name') == 'service_role'), None)
if not secret:
    sys.exit('clé d’administration introuvable')

base = f'https://{ref}.supabase.co/storage/v1'
auth = {'apikey': secret, 'Authorization': f'Bearer {secret}'}
total = 0
if paths:
    call(f'{base}/object/photos', {'prefixes': paths}, auth, 'DELETE')
    total += len(paths)
for co in companies:
    listed = call(f'{base}/object/list/photos', {'prefix': co, 'limit': 1000}, auth, 'POST') or []
    names = [f"{co}/{o['name']}" for o in listed if o.get('name')]
    if names:
        call(f'{base}/object/photos', {'prefixes': names}, auth, 'DELETE')
        total += len(names)
print(f'{total} fichier(s) de test supprimé(s) du stockage')
