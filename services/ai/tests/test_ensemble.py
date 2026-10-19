import unittest, os
from unittest.mock import patch, AsyncMock
from fastapi import HTTPException
from app.ensemble import Request, ensemble
CFG={p:{'enabled':True,'model':p,'external':p!='local'} for p in ['openai','claude','local']}
class Tests(unittest.IsolatedAsyncioTestCase):
 def req(self,**kw):return Request(**({'court':'U.S. District Court','request':'Draft a dismissal motion','source':'Supplied facts and authorities go here.','providers':['openai','claude'],'synthesis_provider':'openai','allow_external':True}|kw))
 async def test_requires_consent_before_transmission(self):
  with patch('app.ensemble.providers',return_value=CFG),patch('app.ensemble.generate',new_callable=AsyncMock) as g:
   with self.assertRaises(HTTPException):await ensemble(self.req(allow_external=False))
   g.assert_not_called()
 async def test_preserves_higher_scoring_draft(self):
  with patch('app.ensemble.providers',return_value=CFG),patch('app.ensemble.generate',new=AsyncMock(side_effect=['A','B','merged','revised'])),patch('app.ensemble.review',new=AsyncMock(side_effect=[{'score':92},{'score':87}])):
   r=await ensemble(self.req());self.assertEqual(r['final_draft'],'merged');self.assertEqual(r['final_review']['score'],92);self.assertTrue(r['target_met']);self.assertEqual(len(r['individual_drafts']),2)
 async def test_provider_failure_never_claims_merged_success(self):
  with patch('app.ensemble.providers',return_value=CFG),patch('app.ensemble.generate',new=AsyncMock(side_effect=['A',RuntimeError('secret')])):
   r=await ensemble(self.req());self.assertEqual(r['status'],'incomplete');self.assertEqual(r['final_draft'],'');self.assertNotIn('secret',str(r))
 async def test_bad_scoring_retains_merge(self):
  with patch('app.ensemble.providers',return_value=CFG),patch('app.ensemble.generate',new=AsyncMock(side_effect=['A','B','merged'])),patch('app.ensemble.review',new=AsyncMock(side_effect=ValueError())):
   r=await ensemble(self.req());self.assertEqual(r['merged_draft'],'merged');self.assertEqual(r['status'],'incomplete')
