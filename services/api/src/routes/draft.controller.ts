import { Body, Controller, Post } from '@nestjs/common';
import axios from 'axios';
@Controller('ai')
export class DraftController {
  @Post('draft') async draft(@Body() body:any){ return (await axios.post((process.env.AI_BASE_URL||'http://ai:8000')+'/drafts',body,{timeout:180000})).data; }
  @Post('analyze') async analyze(@Body() body:any){ return (await axios.post((process.env.AI_BASE_URL||'http://ai:8000')+'/analyze',body,{timeout:180000})).data; }
  @Post('compare') async compare(@Body() body:any){ return (await axios.post((process.env.AI_BASE_URL||'http://ai:8000')+'/compare',body,{timeout:180000})).data; }
}
