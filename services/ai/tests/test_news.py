import unittest
from unittest.mock import patch,AsyncMock
from app.news import allowed,Opinion,opinion
from app.media import Media,media
from fastapi import HTTPException
class NewsTests(unittest.IsolatedAsyncioTestCase):
 def test_allowlist(self):
  self.assertTrue(allowed('https://www.courtlistener.com/opinion/123/example/'))
  for url in ['http://www.courtlistener.com/opinion/123/a/','https://www.courtlistener.com.evil.test/opinion/123/a/','https://evil.test/','https://user@www.courtlistener.com/opinion/123/a/']:
   self.assertFalse(allowed(url))
 async def test_unauthorized_provider_never_receives_source(self):
  with patch('app.news.providers',return_value={'openai':{'enabled':True,'external':True}}),patch('app.news.generate',new_callable=AsyncMock) as g:
   with self.assertRaises(HTTPException):await opinion(Opinion(url='https://www.courtlistener.com/opinion/123/a/',provider='openai'))
   g.assert_not_called()
 async def test_media_failure_is_explicit(self):
  with patch('app.media.command',new=AsyncMock(side_effect=RuntimeError('not installed'))):
   with self.assertRaises(HTTPException):await media(Media(title='Test opinion',narration='An explicitly synthetic commentary narration that is long enough for validation.'))
