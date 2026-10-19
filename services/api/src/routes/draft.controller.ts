import { Body, Controller, Post, Get, BadGatewayException } from '@nestjs/common';
import axios from 'axios';
@Controller('ai')
export class DraftController {
  @Get('providers') async providers(){try{return (await axios.get((process.env.AI_BASE_URL||'http://ai:8000')+'/providers',{timeout:10000})).data;}catch{throw new BadGatewayException('AI service unavailable.');}}
  @Post('ensemble') async ensemble(@Body() body:any){try{return (await axios.post((process.env.AI_BASE_URL||'http://ai:8000')+'/ensemble',body,{timeout:930000})).data;}catch{throw new BadGatewayException('Drafting request failed. Check provider configuration, consent and input limits.');}}
  @Post('draft') async draft(@Body() body:any){ return (await axios.post((process.env.AI_BASE_URL||'http://ai:8000')+'/drafts',body,{timeout:180000})).data; }
  @Post('analyze') async analyze(@Body() body:any){ return (await axios.post((process.env.AI_BASE_URL||'http://ai:8000')+'/analyze',body,{timeout:180000})).data; }
  @Post('compare') async compare(@Body() body:any){ return (await axios.post((process.env.AI_BASE_URL||'http://ai:8000')+'/compare',body,{timeout:180000})).data; }
}
