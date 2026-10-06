from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import os, httpx

app=FastAPI(title="AI Court System AI",version="2.0.0")
OLLAMA=os.getenv("OLLAMA_BASE_URL","http://ollama:11434")
MODEL=os.getenv("OLLAMA_MODEL","llama3.2:3b")
SYSTEM="""You are an AI assistant for legal record organization and drafting. Never invent citations, quotations, record facts, holdings, procedural events, or deadlines. Clearly label uncertainty and missing information. Generated output requires independent human review."""

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
    async with httpx.AsyncClient(timeout=180) as c:
        r=await c.post(f"{OLLAMA}/api/chat",json={"model":MODEL,"messages":[{"role":"system","content":SYSTEM},{"role":"user","content":prompt}],"stream":False,"options":{"temperature":0.15}})
        r.raise_for_status()
        return r.json()["message"]["content"]

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
