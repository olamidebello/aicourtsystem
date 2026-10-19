#!/usr/bin/env python3
"""Export verified JustiSolve hosting state into Olamidepanel's read-only inventory."""
import json,os,re,subprocess,tempfile,time,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parent.parent
port=None
for line in (root/'.env').read_text().splitlines():
    if line.startswith('HTTP_PORT='):
        binding=line.partition('=')[2].strip().strip('\"\'')
        if re.fullmatch(r'127\.0\.0\.1:\d+',binding):port=int(binding.rsplit(':',1)[1])
if not port:raise SystemExit('Private gateway binding unavailable; status not exported.')
commit=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()
def get(url):
    with urllib.request.urlopen(url,timeout=15) as response:
        data=response.read(1000000)
        if response.status!=200:raise ValueError('Service check failed')
        return data
api=json.loads(get(f'http://127.0.0.1:{port}/api/health'))
if api.get('ok') is not True:raise SystemExit('API health failed; status not exported.')
for host in ['justisolve.com','www.justisolve.com']:
    if b'JustiSolve' not in get('https://'+host+'/'):raise SystemExit('Public brand check failed; status not exported.')
path=Path('/var/lib/olamidepanel/hosted-domains.json');path.parent.mkdir(parents=True,exist_ok=True)
if path.exists():
    data=json.loads(path.read_text())
    if not isinstance(data,dict) or not isinstance(data.get('domains'),list):raise SystemExit('Existing panel snapshot invalid; refusing overwrite.')
else:data={'domains':[]}
rows=[r for r in data['domains'] if r.get('domain') not in ['justisolve.com','www.justisolve.com']]
now=int(time.time())
for host in ['justisolve.com','www.justisolve.com']:
    rows.append({'domain':host,'status':'https_ready','www':'ready','deployment_status':'application_ready','checked_at':now,'deployment_checked_at':now,'repo':'olamidebello/justisolve','commit':commit,'backend':f'http://127.0.0.1:{port}','configuration':'/etc/nginx/sites-available/justisolve.com'})
data.update(domains=rows,updated_at=now)
fd,name=tempfile.mkstemp(prefix='.justisolve-status-',dir=path.parent)
try:
    with os.fdopen(fd,'w') as f:json.dump(data,f,indent=2);f.write('\n')
    os.chmod(name,0o644);os.replace(name,path)
finally:
    if os.path.exists(name):os.unlink(name)
print('JustiSolve application and both HTTPS hostnames verified; panel hosting status updated.')
