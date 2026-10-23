"""Runtime settings supplied by the API; provider secrets never leave internal routes."""
import os, secrets, re
import httpx
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
router=APIRouter()

def configuration():
    token=os.getenv('AI_CONFIG_TOKEN','')
    if not token:
        return {}
    try:
        r=httpx.get(os.getenv('API_CONFIG_URL','http://api:4000/api/internal/ai/config'),headers={'X-AI-Config-Token':token},timeout=5,follow_redirects=False)
        r.raise_for_status()
        data=r.json()
        if not isinstance(data,dict):raise ValueError()
        return data
    except Exception:
        # Never reactivate an environment key when a managed provider was disabled.
        return {k:{'enabled':False,'use_server_key':False,'models':[]} for k in ['openai','claude','ollama']}

def effective(provider,config=None):
    config=configuration() if config is None else config
    override=config.get(provider)
    keyvar='OPENAI_API_KEY' if provider=='openai' else 'ANTHROPIC_API_KEY'
    modelvar='OPENAI_MODEL' if provider=='openai' else 'ANTHROPIC_MODEL'
    if provider=='ollama':
        models=[m.strip() for m in os.getenv('OLLAMA_DRAFT_MODELS',os.getenv('OLLAMA_MODEL','llama3.2:3b')).split(',') if m.strip()][:4]
        return {'enabled':True,'models':models} if override is None else {'enabled':override.get('enabled',False),'models':override.get('models',models)}
    key=os.getenv(keyvar,'')
    model=os.getenv(modelvar,'')
    if override is not None:
        key=override.get('api_key','') or (key if override.get('use_server_key',False) else '')
        model=override.get('model','')
    enabled=bool(key and model) and (override is None or override.get('enabled',False))
    return {'api_key':key,'model':model,'enabled':enabled,'key_configured':bool(key),'source':'server environment' if override is None else 'super admin'}

def authorize(token):
    expected=os.getenv('AI_CONFIG_TOKEN','')
    if not token or not expected or not secrets.compare_digest(token,expected):raise HTTPException(401,'Internal authorization required.')

@router.get('/admin/models/{provider}')
async def models(provider:str,x_ai_config_token:str=Header(default='')):
    authorize(x_ai_config_token)
    if provider not in ['openai','claude','ollama']:raise HTTPException(400,'Unknown provider.')
    cfg=effective(provider)
    try:
        async with httpx.AsyncClient(timeout=15,follow_redirects=False) as c:
            if provider=='ollama':
                r=await c.get(os.getenv('OLLAMA_BASE_URL','http://ollama:11434')+'/api/tags')
            elif provider=='openai':
                if not cfg['api_key']:raise ValueError()
                r=await c.get('https://api.openai.com/v1/models',headers={'Authorization':'Bearer '+cfg['api_key']})
            else:
                if not cfg['api_key']:raise ValueError()
                r=await c.get('https://api.anthropic.com/v1/models',headers={'x-api-key':cfg['api_key'],'anthropic-version':'2023-06-01'},params={'limit':1000})
            r.raise_for_status()
            values=r.json().get('models' if provider=='ollama' else 'data',[])
            names=sorted({x.get('name' if provider=='ollama' else 'id','') for x in values if isinstance(x,dict)})
            selected=cfg.get('models',[]) if provider=='ollama' else [cfg.get('model','')]
            ready=all(m in names or (provider=='ollama' and m+':latest' in names) for m in selected) and bool(selected)
            return {'status':'ready' if ready else 'warning','models':[m for m in names if m],'message':'Connection verified; selected models found.' if ready else 'Connection verified. Select an available model. Model listing does not verify generation capability or available quota.'}
    except Exception:
        raise HTTPException(502,'Provider connection failed. Check saved credentials, model access and network.')

class Pull(BaseModel):
    model:str=Field(min_length=1,max_length=200)

@router.post('/admin/local-models/pull')
async def pull(req:Pull,x_ai_config_token:str=Header(default='')):
    authorize(x_ai_config_token)
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}',req.model):raise HTTPException(400,'Invalid model name.')
    try:
        async with httpx.AsyncClient(timeout=850,follow_redirects=False) as c:
            r=await c.post(os.getenv('OLLAMA_BASE_URL','http://ollama:11434')+'/api/pull',json={'model':req.model,'stream':False})
            r.raise_for_status()
            if r.json().get('status')!='success':raise ValueError()
        return {'status':'ready','message':'Model downloaded. Add it to the enabled local models and save to use it.'}
    except Exception:
        raise HTTPException(502,'Model download failed or timed out. Check installed models before retrying.')
