import base64,unittest
from app.intake import Document,extract
class IntakeTests(unittest.TestCase):
 def test_text_has_source_labels(self):
  text,warnings=extract(Document(filename='facts.txt',content_base64=base64.b64encode(b'Events from a document.').decode()),1)
  self.assertIn('[D1]',text);self.assertEqual(warnings,[])
 def test_unsupported_and_invalid_files_fail_explicitly(self):
  for filename in ['image.jpg','fake.pdf']:
   with self.assertRaises(ValueError):extract(Document(filename=filename,content_base64=base64.b64encode(b'not a PDF').decode()),1)
