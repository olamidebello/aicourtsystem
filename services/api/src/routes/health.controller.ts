import { Controller, Get } from '@nestjs/common';
@Controller('health')
export class HealthController {
  @Get() health(){ return {ok:true, service:'api', version:'2.0.0', time:new Date().toISOString()}; }
}
