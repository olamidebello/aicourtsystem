"""Local synthetic speech and caption-card video; no voice cloning or impersonation."""
import asyncio, base64, tempfile, textwrap
from pathlib import Path
from pydantic import BaseModel,Field
from fastapi import APIRouter,HTTPException
router=APIRouter()
class Media(BaseModel):
    title:str=Field(min_length=1,max_length=400)
    narration:str=Field(min_length=50,max_length=2500)
async def command(*args):
    p=await asyncio.create_subprocess_exec(*args,stdout=asyncio.subprocess.DEVNULL,stderr=asyncio.subprocess.DEVNULL)
    try:
        code=await asyncio.wait_for(p.wait(),180)
        if code:raise ValueError('Media command failed')
    except BaseException:
        if p.returncode is None:p.kill();await p.wait()
        raise
@router.post('/news/media')
async def media(req:Media):
    try:
        with tempfile.TemporaryDirectory(prefix='justisolve-media-') as directory:
            p=Path(directory)
            narration='AI-generated news commentary. Not an official court order. '+req.narration+' Read the source ruling and full commentary on JustiSolve.'
            (p/'speech.txt').write_text(narration)
            title='\n'.join(textwrap.wrap(req.title[:180],45))[:500]
            (p/'card.txt').write_text('JustiSolve\n\nAI Opinion Order - Commentary\n\n'+title+'\n\nAI-generated synthetic audio and video\nNot an official court order\nRead the source ruling before relying on this story.')
            await command('espeak-ng','-v','en-us','-s','155','-f',str(p/'speech.txt'),'-w',str(p/'audio.wav'))
            await command('ffmpeg','-y','-i',str(p/'audio.wav'),'-codec:a','libmp3lame','-b:a','96k',str(p/'audio.mp3'))
            await command('ffmpeg','-y','-f','lavfi','-i','color=c=0x0b2945:s=1280x720:r=10','-i',str(p/'audio.wav'),'-vf',f"drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile={p/'card.txt'}:expansion=none:fontcolor=white:fontsize=30:x=65:y=65:line_spacing=12",'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-shortest','-movflags','+faststart',str(p/'video.mp4'))
            audio=(p/'audio.mp3').read_bytes();video=(p/'video.mp4').read_bytes()
            if max(len(audio),len(video))>15000000:raise ValueError('Media size limit')
            return {'audio_base64':base64.b64encode(audio).decode(),'video_base64':base64.b64encode(video).decode(),'voice':'espeak-ng synthetic en-us','disclosure':'AI-generated commentary, not an official court order'}
    except Exception:raise HTTPException(502,'Audio/video generation failed. Check ffmpeg, espeak-ng, memory and available disk.')
