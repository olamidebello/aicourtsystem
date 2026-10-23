import unittest,os
from unittest.mock import patch,MagicMock,AsyncMock
from fastapi import HTTPException
from app.model_catalog import text_model,latest_models
from app.ensemble import providers,available,resolve,generate

CONFIG={'openai':{'enabled':True,'use_server_key':False,'api_key':'synthetic-secret','models':['gpt-5.4','gpt-6-sol','gpt-6.1-sol']},'ollama':{'enabled':True,'models':['local:model']}}
class CatalogTests(unittest.TestCase):
 def test_latest_default_and_multiple_models_are_separate_options(self):
  with patch('app.ensemble.configuration',return_value=CONFIG):
   rows=available();self.assertEqual(sum(bool(r['is_default']) for r in rows),1)
   self.assertEqual(next(r['model'] for r in rows if r['is_default']),'gpt-6.1-sol')
   self.assertEqual({r['model'] for r in rows if r['vendor']=='openai'},{'gpt-5.4','gpt-6-sol','gpt-6.1-sol'})
   self.assertNotIn('synthetic-secret',str(rows));self.assertNotIn('openai',[r['id'] for r in rows])
   self.assertEqual(resolve('openai:gpt-5.4',True)[1]['model'],'gpt-5.4')
   self.assertEqual(resolve('openai',True)[1]['model'],'gpt-6.1-sol')
 def test_default_requires_consent_and_unprovisioned_models_are_rejected(self):
  with patch('app.ensemble.configuration',return_value=CONFIG):
   with self.assertRaises(HTTPException):resolve('latest',False)
   with self.assertRaises(HTTPException):resolve('openai:gpt-99-sol',True)
   self.assertEqual(resolve('latest',True)[0],'openai:gpt-6.1-sol')
 def test_nontext_models_are_filtered_and_new_generation_becomes_latest(self):
  for name in ['gpt-image-2.5-flare','gpt-4o-transcribe','gpt-audio','gpt-realtime-2','text-embedding-3-large','gpt-5-search-api','gpt-5.3-codex']:
   self.assertFalse(text_model('openai',name))
  self.assertEqual(latest_models('openai',['gpt-6.1-sol','gpt-6.2-sol','gpt-6-astra'])[0],'gpt-6.2-sol')
 def test_disabling_hosted_provider_falls_back_to_enabled_local(self):
  config={**CONFIG,'openai':{**CONFIG['openai'],'enabled':False}}
  with patch('app.ensemble.configuration',return_value=config):self.assertEqual(resolve('latest',False)[0],'ollama:local:model')
class GenerationTests(unittest.IsolatedAsyncioTestCase):
 async def test_specific_model_choices_reach_the_provider_payload(self):
  response=MagicMock();response.json.return_value={'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'Draft'}]}]}
  client=MagicMock();client.post=AsyncMock(return_value=response)
  manager=MagicMock();manager.__aenter__=AsyncMock(return_value=client);manager.__aexit__=AsyncMock()
  with patch('app.ensemble.configuration',return_value=CONFIG),patch('app.ensemble.httpx.AsyncClient',return_value=manager):
   await generate('openai:gpt-5.4','source');await generate('openai:gpt-6.1-sol','source')
   self.assertEqual([c.kwargs['json']['model'] for c in client.post.call_args_list],['gpt-5.4','gpt-6.1-sol'])
