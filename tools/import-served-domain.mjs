// Explicit local replay of the approved, read-only domain export. No remote services or credentials are used.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'served-data');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const targets=[
 {name:'service',file:'data-private/experience/preview.sqlite',migrations:'drizzle',tables:['workbench','facility_notes','audit']},
 {name:'editor',file:'toolkit/data-private/editor.sqlite',migrations:'toolkit/drizzle',tables:['editor_projects','editor_files','reports','report_photos','proposals','report_jobs','work_files','work_messages','station_layers','audit_log']},
];
for(const t of targets){
 const dbPath=path.join(root,t.file);fs.mkdirSync(path.dirname(dbPath),{recursive:true});const db=new DatabaseSync(dbPath);db.exec('PRAGMA busy_timeout=5000');
 try{
  db.exec('CREATE TABLE IF NOT EXISTS preview_migrations (name TEXT PRIMARY KEY)');
  for(const file of fs.readdirSync(path.join(root,t.migrations)).filter(f=>f.endsWith('.sql')).sort())if(!db.prepare('SELECT name FROM preview_migrations WHERE name=?').get(file)){
   db.exec('BEGIN');try{db.exec(fs.readFileSync(path.join(root,t.migrations,file),'utf8'));db.prepare('INSERT INTO preview_migrations VALUES (?)').run(file);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
  }
  const bytes=fs.readFileSync(path.join(source,t.name+'-domain.sql')),hash=digest(bytes);
  db.exec('CREATE TABLE IF NOT EXISTS served_export_imports (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL)');
  const previous=db.prepare('SELECT sha256 FROM served_export_imports WHERE name=?').get(t.name);
  if(previous?.sha256===hash){console.log(t.name+': same export already imported; preserved');continue;}
  const count=t.tables.reduce((sum,table)=>sum+Number(db.prepare('SELECT count(*) AS n FROM "'+table+'"').get().n),0);
  if(count)throw Error(t.name+': local domain tables are not empty; use a new local DB. Existing records were preserved.');
  db.exec(bytes.toString('utf8'));db.prepare('INSERT INTO served_export_imports (name,sha256) VALUES (?,?)').run(t.name,hash);
  console.log(t.name+': domain export imported without authentication/session rows');
 }finally{db.close();}
}
const from=path.join(source,'uploads'),to=path.join(root,'toolkit/data-private/uploads');
function copy(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){copy(file);continue;}const rel=path.relative(from,file),target=path.join(to,rel),bytes=fs.readFileSync(file);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)&&digest(fs.readFileSync(target))!==digest(bytes))throw Error('Existing local upload differs: '+rel);fs.writeFileSync(target,bytes);}}
if(fs.existsSync(from))copy(from);
console.log('Public preview bytes copied; unavailable private R2 originals were not fabricated.');
