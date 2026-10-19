import { Controller, Get } from '@nestjs/common';
import { DbService } from '../db.service';
@Controller('health')
export class HealthController {
 constructor(private db:DbService){}
 @Get() async health(){await this.db.query('SELECT 1');return {ok:true,service:'api',version:'2.1.0'};}
}
