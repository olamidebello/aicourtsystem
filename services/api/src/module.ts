import {CommunicationsController} from './routes/communications.controller';
import {ControlsController} from './routes/controls.controller';
import {TenantsController} from './routes/tenants.controller';
import {JusticeController} from './routes/justice.controller';
import {AiProvisioningController} from './routes/ai-provisioning.controller';
import {CommerceService} from './commerce.service';
import {CommerceAdminController,MarketplaceController} from './routes/commerce.controller';
import { AccountAccessController } from './routes/account-access.controller';
import { AccountMailer } from './account-mailer';
import { IntakeController } from './routes/intake.controller';
import { CourtAutomationService } from './court-automation.service';
import { CourtAutomationController } from './routes/court-automation.controller';
import { APP_GUARD } from '@nestjs/core';
import { AccessGuard } from './auth';
import { AdminController } from './routes/admin.controller';
import { NewsController } from './routes/news.controller';
import { NewsService } from './news.service';
import { PacerController } from './routes/pacer.controller';
import { Module } from '@nestjs/common';
import { DbService } from './db.service';
import { HealthController } from './routes/health.controller';
import { DraftController } from './routes/draft.controller';
import { EvidenceController } from './routes/evidence.controller';
import { PlatformController } from './routes/platform.controller';
@Module({providers:[CommerceService,AccountMailer,CourtAutomationService,DbService,NewsService,{provide:APP_GUARD,useClass:AccessGuard}],controllers:[CommunicationsController,ControlsController,TenantsController,JusticeController,AiProvisioningController,CommerceAdminController,MarketplaceController,AccountAccessController,IntakeController,CourtAutomationController,AdminController,NewsController,PacerController,HealthController,DraftController,EvidenceController,PlatformController]})
export class AppModule {}
