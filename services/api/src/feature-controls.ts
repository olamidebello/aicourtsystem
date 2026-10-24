import {ForbiddenException} from '@nestjs/common';
export const PLATFORM_FEATURES=['registration','organizations','license_checks','cases','proceedings','intake','pacer','marketplace','ensemble','ai','news','automation','email','phone'];
export function featureForRoute(route:string){
 if(route==='/admin/auth/register')return 'registration';
 if(route.startsWith('/justice/phone'))return 'phone';
 if(route.startsWith('/justice/organizations'))return 'organizations';
 if(route.startsWith('/justice/licenses'))return 'license_checks';
 if(/^\/justice\/matters\/\d+\/proceedings/.test(route))return 'proceedings';
 if(route.startsWith('/justice/matters')||/^\/(cases|dockets|documents|evidence|tasks|deadlines|research|transcripts)(\/|$)/.test(route))return 'cases';
 if(route.startsWith('/intake'))return 'intake';if(route.startsWith('/pacer/'))return 'pacer';if(route.startsWith('/marketplace'))return 'marketplace';
 if(route==='/ai/ensemble')return 'ensemble';if(/^\/ai\/(draft|analyze|compare)$/.test(route))return 'ai';
 if(/^\/admin\/news\/\d+\/media$/.test(route))return 'news';
 if(route==='/news'||/^\/news\/\d+\/media/.test(route))return 'news';
 if(route.startsWith('/admin/court-automations'))return 'automation';return null;
}
export async function platformFeatures(db:any){const row=(await db.query("SELECT value FROM platform_settings WHERE key='platform_features'")).rows[0];return Object.fromEntries(PLATFORM_FEATURES.map(k=>[k,row?.value?.[k]!==false]));}
export async function enforceFeature(db:any,route:string){const feature=featureForRoute(route);if(!feature)return;const flags=await platformFeatures(db);if(flags[feature]===false||['intake','ensemble','proceedings'].includes(feature)&&flags.ai===false)throw new ForbiddenException('This feature is disabled by the platform administrator.');}
