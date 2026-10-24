import {COMMUNICATIONS_SCHEMA} from './communications-schema';
import {JUSTICE_SCHEMA} from './justice-schema';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { COMMERCE_SCHEMA } from './commerce-schema';
import { ADMIN_SCHEMA } from './admin-schema';
import { Pool } from 'pg';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  readonly pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://aicourt:aicourt@postgres:5432/aicourt' });
  async onModuleInit(){
    const client=await this.pool.connect();
    try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(736191)');await client.query(ADMIN_SCHEMA);await client.query(COMMERCE_SCHEMA);await client.query(JUSTICE_SCHEMA);await client.query(COMMUNICATIONS_SCHEMA);await client.query('COMMIT');}
    catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  query(text:string, params:any[]=[]){ return this.pool.query(text, params); }
  async onModuleDestroy(){ await this.pool.end(); }
}
