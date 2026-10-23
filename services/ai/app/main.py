from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import os, httpx

app=FastAPI(title="JustiSolve AI",version="2.0.0")
OLLAMA=os.getenv("OLLAMA_BASE_URL","http://ollama:11434")
MODEL=os.getenv("OLLAMA_MODEL","llama3.2:3b")
SYSTEM="""You are an AI assistant for legal record organization and drafting. Never invent citations, quotations, record facts, holdings, procedural events, or deadlines. Clearly label uncertainty and missing information. Always use formal court filing style: court caption, case number, parties, motion title, introduction, procedural background, facts with supplied record references, legal standard, numbered argument headings, specific requested relief, date and signature block. Include certificate of service only when requested/applicable; never fabricate completed service. Follow supplied jurisdiction and local rules, and mark missing caption, rule, signature or service details with placeholders. Generated output requires independent human review."""

class DraftReq(BaseModel):
    filing_type:str="memorandum"
    inputs:dict=Field(default_factory=dict)
    tone:str="formal"
    include_certificate_of_service:bool=True
    include_proposed_order:bool=False
class AnalyzeReq(BaseModel):
    text:str
    task:str="summarize"
    context:str=""
class CompareReq(BaseModel):
    left:str
    right:str
    task:str="compare"

async def chat(prompt:str):
    from .ensemble import providers, generate
    local=[p for p,cfg in providers().items() if cfg['enabled'] and not cfg['external']]
    if not local:raise HTTPException(503,'Enable a local AI model in Super Admin AI provisioning. Hosted providers require a provider-selection workflow with external-processing consent.')
    return await generate(local[0],prompt,system=SYSTEM)

@app.get("/health")
def health(): return {"ok":True,"model":MODEL}

@app.post("/drafts")
async def draft(req:DraftReq):
    prompt=f"""Draft a {req.filing_type}. Tone: {req.tone}. Use ONLY supplied facts and authorities. If required information is absent, insert [MISSING INFORMATION]. Organize with court-ready headings. Inputs:\n{req.inputs}\nCertificate of service: {req.include_certificate_of_service}. Proposed order: {req.include_proposed_order}."""
    return {"draft_markdown":await chat(prompt),"warnings":["AI-generated draft: verify every factual and legal assertion before use."]}

@app.post("/analyze")
async def analyze(req:AnalyzeReq):
    if not req.text.strip(): raise HTTPException(400,"text required")
    prompt=f"""Task: {req.task}\nContext: {req.context}\nAnalyze the following source without inventing facts. Separate facts, issues, authorities, missing information, contradictions, deadlines if explicitly stated, and suggested review items.\nSOURCE:\n{req.text}"""
    return {"analysis":await chat(prompt),"model":MODEL}

@app.post("/compare")
async def compare(req:CompareReq):
    prompt=f"""Task: {req.task}. Compare SOURCE A and SOURCE B. Identify agreements, conflicts, omissions, date/name/citation differences, and material changes. Do not infer facts not in either source.\nSOURCE A:\n{req.left}\n\nSOURCE B:\n{req.right}"""
    return {"analysis":await chat(prompt),"model":MODEL}

from .ensemble import router as ensemble_router
app.include_router(ensemble_router)

from .news import router as news_router
app.include_router(news_router)

from .media import router as media_router
app.include_router(media_router)

from .intake import router as intake_router
app.include_router(intake_router)

from .provisioning import router as provisioning_router
app.include_router(provisioning_router)
