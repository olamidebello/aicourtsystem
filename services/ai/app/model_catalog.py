"""Text-model eligibility and latest-provisioned ordering, without live generation."""
import re

def text_model(provider,name):
    if provider!='openai':return True
    name=name.lower()
    if any(x in name for x in ['image','audio','transcrib','tts','realtime','search','codex','instruct','chat-latest']):return False
    return bool(re.match(r'^(?:gpt-(?:[5-9]|[1-9]\d)|gpt-4(?:\.1|o)(?:-|$)|o[134](?:-|$))',name))

def latest_models(provider,names,created=None):
    names=list(dict.fromkeys(names));created=created or {}
    if provider=='ollama':return names
    def rank(name):
        if provider=='openai':
            m=re.match(r'gpt-(\d+)(?:\.(\d+))?',name)
            version=(int(m[1]),int(m[2] or 0)) if m else (0,0)
        else:
            parts=[int(x) for x in re.findall(r'\d+',name) if len(x)<4]
            version=tuple(parts[:2]+[0]*(2-len(parts[:2])))
        # Prefer a stable family alias over a dated snapshot of the same family.
        snapshot=bool(re.search(r'\d{4}-?\d{2}-?\d{2}',name))
        return (*version,int(created.get(name,0) or 0),not snapshot,name)
    return sorted(names,key=rank,reverse=True)
