// Mechanical source-only mirror into the private main repository.
// Run after committing the public toolkit, before committing the service release.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const service=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=path.resolve(service,'../ya-nerd-station-editor'),target=path.join(service,'toolkit');
if(execFileSync('git',['status','--porcelain'],{cwd:source,encoding:'utf8'}).trim())throw Error('Commit the public toolkit first; refusing a partial source mirror.');
const names=execFileSync('git',['ls-files','-z'],{cwd:source,encoding:'utf8'}).split('\0').filter(Boolean);
for(const name of names){if(name.startsWith('/')||name.split('/').includes('..')||/^(\.env|data-private\/|node_modules\/|dist\/|\.git\/)/.test(name))throw Error('Unexpected source path');const from=path.join(source,name),to=path.join(target,name);if(fs.lstatSync(from).isSymbolicLink())throw Error('Symlink not allowed');fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
const sha=execFileSync('git',['rev-parse','--verify','HEAD'],{cwd:source,encoding:'utf8'}).trim();
fs.writeFileSync(path.join(target,'UPSTREAM.json'),JSON.stringify({repository:'https://github.com/Kminer2053/ya-nerd-station',commit:sha,files:names},null,2)+'\n');
console.log(`Mirrored ${names.length} tracked toolkit source files at ${sha}. No credentials, database, uploads, tiles or build outputs copied.`);
