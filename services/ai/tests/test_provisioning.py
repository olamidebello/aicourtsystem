import unittest,os
from unittest.mock import patch,MagicMock,AsyncMock
from fastapi import HTTPException
from app.provisioning import configuration,effective,models,pull,Pull
from app.ensemble import providers,available

class ConfigurationTests(unittest.TestCase):
 def test_existing_environment_reuse_and_public_redaction(self):
  with patch.dict(os.environ,{'OPENAI_API_KEY':'test-private-key','OPENAI_MODEL':'gpt-6.1-sol','AI_CONFIG_TOKEN':''}),patch('app.ensemble.configuration',return_value={}):
   self.assertTrue(providers()['openai']['enabled']);self.assertNotIn('test-private-key',str(available()));self.assertNotIn('api_key',available()[0])
 def test_saved_key_override_and_removal_prevent_environment_fallback(self):
  with patch.dict(os.environ,{'OPENAI_API_KEY':'legacy-private-key','OPENAI_MODEL':'legacy'}):
   cfg=effective('openai',{'openai':{'enabled':True,'model':'gpt-6.1-sol','api_key':'saved-private-key','use_server_key':True}})
   self.assertEqual(cfg['api_key'],'saved-private-key');self.assertEqual(cfg['model'],'gpt-6.1-sol')
   cfg=effective('openai',{'openai':{'enabled':False,'model':'gpt-6.1-sol','api_key':'','use_server_key':False}})
   self.assertFalse(cfg['enabled']);self.assertEqual(cfg['api_key'],'')
 def test_control_plane_failure_disables_instead_of_reusing_stale_keys(self):
  with patch.dict(os.environ,{'AI_CONFIG_TOKEN':'internal-token','OPENAI_API_KEY':'legacy','OPENAI_MODEL':'legacy'}),patch('app.provisioning.httpx.get',side_effect=RuntimeError('sensitive details')):
   data=configuration();self.assertFalse(effective('openai',data)['enabled']);self.assertFalse(effective('ollama',data)['enabled'])
 def test_configured_local_models_replace_environment_list(self):
  with patch('app.ensemble.configuration',return_value={'ollama':{'enabled':False,'models':['local:test']}}):
   cfg=providers();self.assertIn('ollama:local:test',cfg);self.assertFalse(cfg['ollama:local:test']['enabled'])

class EndpointTests(unittest.IsolatedAsyncioTestCase):
 async def test_internal_test_and_download_require_authorization(self):
  with patch.dict(os.environ,{'AI_CONFIG_TOKEN':'internal-token'}):
   with self.assertRaises(HTTPException):await models('openai','wrong-token')
   with self.assertRaises(HTTPException):await pull(Pull(model='test:model'),'wrong-token')
 async def test_model_list_is_read_only_and_redacts_secrets(self):
  response=MagicMock();response.json.return_value={'data':[{'id':'gpt-6.1-sol'}]}
  client=MagicMock();client.get=AsyncMock(return_value=response);client.post=AsyncMock()
  manager=MagicMock();manager.__aenter__=AsyncMock(return_value=client);manager.__aexit__=AsyncMock()
  with patch.dict(os.environ,{'AI_CONFIG_TOKEN':'internal-token'}),patch('app.provisioning.effective',return_value={'api_key':'private','model':'gpt-6.1-sol','models':['gpt-6.1-sol']}),patch('app.provisioning.httpx.AsyncClient',return_value=manager):
   r=await models('openai','internal-token');self.assertEqual(r['status'],'ready');self.assertNotIn('private',str(r));client.post.assert_not_called()
 async def test_model_download_uses_fixed_local_endpoint(self):
  response=MagicMock();response.json.return_value={'status':'success'}
  client=MagicMock();client.post=AsyncMock(return_value=response)
  manager=MagicMock();manager.__aenter__=AsyncMock(return_value=client);manager.__aexit__=AsyncMock()
  with patch.dict(os.environ,{'AI_CONFIG_TOKEN':'internal-token','OLLAMA_BASE_URL':'http://ollama:11434'}),patch('app.provisioning.httpx.AsyncClient',return_value=manager):
   r=await pull(Pull(model='local:test'),'internal-token');self.assertEqual(r['status'],'ready');self.assertEqual(client.post.call_args.args[0],'http://ollama:11434/api/pull')
