"""Exercise the actual Ansible playbook with mock Docker; no host services touched.
Run: python scripts/test-inspection.py (requires ansible-core).
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

REPO = Path(__file__).resolve().parent.parent
MOCK = '''#!/usr/bin/env python3
import json,os,pathlib,sys
args=sys.argv[1:];root=pathlib.Path(os.environ['INSPECTION_TEST_DIR'])
with (root/'calls').open('a') as f:f.write(json.dumps(args)+'\\n')
mode=os.environ['INSPECTION_TEST_MODE']
if 'build' in args and args[-1]=='api' and '--no-cache' not in args and mode=='repair':sys.exit(1)
if 'exec' in args and 'node' in args:
 feature=args[-1]
 if feature=='dashboard' and not (root/'restarted').exists():
  print(json.dumps({'feature':feature,'status':'failed','reason':'mock transient'}));sys.exit(1)
 print(json.dumps({'feature':feature,'status':'attention' if mode=='attention' and feature=='account-email' else 'passed'}))
elif 'restart' in args:(root/'restarted').write_text('yes')
elif 'inspect' in args:print('running healthy')
elif 'ps' in args:print('mock-container-id')
else:print('mock command complete')
'''

class InspectionTests(unittest.TestCase):
 def run_case(self,mode,repair=True):
  with tempfile.TemporaryDirectory(prefix='justisolve-inspection-') as directory:
   root=Path(directory);(root/'docker').write_text(MOCK);(root/'docker').chmod(0o755)
   env={**os.environ,'PATH':str(root)+os.pathsep+os.environ['PATH'],'INSPECTION_TEST_DIR':str(root),'INSPECTION_TEST_MODE':mode}
   if mode=='attention':(root/'restarted').write_text('yes')
   command=[sys.executable,'-m','ansible.cli.playbook','-i','localhost,','-c','local',str(REPO/'ansible/inspect.yml'),'-e',f'app_dir={root}','-e',json.dumps({'repair_enabled':repair,'inspection_features':['dashboard','account-email','cases']})]
   result=subprocess.run(command,env=env,capture_output=True,text=True,timeout=180)
   report=root/'inspection-reports/latest.json'
   self.assertTrue(report.exists(),result.stdout+result.stderr)
   data=json.loads(report.read_text());calls=[json.loads(line) for line in (root/'calls').read_text().splitlines()]
   return result.returncode,data['results'],calls
 def test_repairs_failed_build_and_retries_feature_before_continuing(self):
  rc,results,calls=self.run_case('repair')
  self.assertEqual(rc,0);self.assertTrue(any('build' in c and '--no-cache' in c for c in calls))
  self.assertTrue(any('restart' in c for c in calls));self.assertEqual(next(x for x in results if x['feature']=='cases')['status'],'passed')
 def test_configuration_attention_remains_failure_in_report(self):
  rc,results,_=self.run_case('attention')
  self.assertNotEqual(rc,0);self.assertEqual(next(x for x in results if x['feature']=='account-email')['status'],'attention')
  self.assertEqual(next(x for x in results if x['feature']=='cases')['status'],'passed')
 def test_read_only_mode_does_not_build_or_restart(self):
  rc,results,calls=self.run_case('read-only',False)
  self.assertNotEqual(rc,0);self.assertFalse(any(any(x in c for x in ['build','restart','up']) for c in calls))
  self.assertEqual(next(x for x in results if x['feature']=='dashboard')['status'],'failed')

if __name__=='__main__':unittest.main()
