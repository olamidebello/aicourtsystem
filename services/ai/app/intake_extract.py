"""Resource-limited extraction subprocess for untrusted uploaded documents."""
import json,resource,sys
resource.setrlimit(resource.RLIMIT_AS,(512*1024*1024,512*1024*1024))
resource.setrlimit(resource.RLIMIT_CPU,(20,20))
from .intake import Document,extract
try:
    packet=json.loads(sys.stdin.buffer.read(16000000))
    text,warnings=extract(Document(**packet['document']),int(packet['index']))
    print(json.dumps({'text':text,'warnings':warnings}))
except Exception:
    sys.exit(1)
