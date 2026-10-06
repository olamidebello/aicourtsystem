import { Module } from '@nestjs/common';
import { DbService } from './db.service';
import { HealthController } from './routes/health.controller';
import { DraftController } from './routes/draft.controller';
import { EvidenceController } from './routes/evidence.controller';
import { PlatformController } from './routes/platform.controller';
@Module({providers:[DbService],controllers:[HealthController,DraftController,EvidenceController,PlatformController]})
export class AppModule {}
