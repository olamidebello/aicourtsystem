import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://aicourt:aicourt@postgres:5432/aicourt' });
  query(text:string, params:any[]=[]){ return this.pool.query(text, params); }
  async onModuleDestroy(){ await this.pool.end(); }
}
