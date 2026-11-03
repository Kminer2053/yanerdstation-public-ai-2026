// Archive what exists only in the Supabase workbench before it is retired: replacement versions (with their images),
// review/work state and comments. Seed tables (image occurrences, feature placements, texture slots) are rebuilt from
// supabase/migrations and the local VWorld catalog outputs, so only their row counts are recorded. Profiles are kept
// without e-mail addresses. Keys come from .env.local and are never printed. Read-only apart from one anonymous session.
// Usage: node tools/archive-supabase.mjs [--dry-run] [out-dir]
import {createClient} from '@supabase/supabase-js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';

const dry=process.argv.includes('--dry-run'),out=resolve(process.argv.slice(2).find(a=>!a.startsWith('--'))||'../tmp/supabase-archive-'+new Date().toISOString().slice(0,10).replaceAll('-',''));
const env=Object.fromEntries(readFileSync('.env.local','utf8').split('\n').map(l=>l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].trim().replace(/^['"]|['"]$/g,'')]));
const sb=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {error:authError}=await sb.auth.signInAnonymously({options:{data:{display_name:'보관용 내보내기',public_editor:true}}});if(authError)throw authError;

const KEEP={object_slot_replacement_versions:'*',replacement_versions:'*',object_slot_work_items:'*',catalog_work_items:'*',catalog_comments:'*',catalog_manifests:'*',profiles:'id,display_name,role,membership_state,created_at'};
const COUNT_ONLY=['object_texture_slots','image_occurrences','feature_placements'];
async function all(table,columns){const rows=[];for(let from=0;;from+=1000){const {data,error}=await sb.from(table).select(columns).range(from,from+999);if(error)return {rows,error:error.message};rows.push(...data);if(data.length<1000)return {rows};}}
const report={archived_at:new Date().toISOString(),dry_run:dry,tables:{},images:{count:0,bytes:0,missing:[]}};
if(!dry)mkdirSync(join(out,'images'),{recursive:true});
for(const [table,columns] of Object.entries(KEEP)){const {rows,error}=await all(table,columns);report.tables[table]={rows:rows.length,...(error?{error}:{})};if(!dry)writeFileSync(join(out,table+'.json'),JSON.stringify(rows,null,1));
 if(!error&&/replacement_versions$/.test(table))for(const r of rows){if(!r.storage_path)continue;report.images.count++;
  if(dry)continue;const {data:blob,error:e}=await sb.storage.from('vworld-catalog-replacements').download(r.storage_path);
  if(e){report.images.missing.push(r.storage_path);continue;}const bytes=Buffer.from(await blob.arrayBuffer());report.images.bytes+=bytes.length;writeFileSync(join(out,'images',r.storage_path.replaceAll('/','__')),bytes);}}
for(const table of COUNT_ONLY){const {count,error}=await sb.from(table).select('*',{count:'exact',head:true});report.tables[table]={rows:count,count_only:true,...(error?{error:error.message}:{})};}
if(!dry)writeFileSync(join(out,'report.json'),JSON.stringify(report,null,1));
await sb.auth.signOut();
console.log(JSON.stringify({out:dry?null:out,...report},null,1));
