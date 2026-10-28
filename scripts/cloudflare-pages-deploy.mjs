import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
export const projectName='shab-legal-consultancy-app';
export const siteOrigin=`https://${projectName}.pages.dev`;
export function validateProject(result) {
  if(!result?.success || result.result?.name!==projectName || result.result?.subdomain!==`${projectName}.pages.dev`) throw new Error('Cloudflare project lookup failed or returned a different Pages site.');
  const branch=result.result.production_branch;
  if(typeof branch!=='string' || !/^[A-Za-z0-9._/-]+$/.test(branch)) throw new Error('Cloudflare did not return a valid production branch.');
  return branch;
}
export function entryAsset(html) {
  const entry=html.match(/<script\b[^>]*src=["'](\/assets\/[^"']+\.js)["'][^>]*>/i)?.[1];
  if(!entry || entry.includes('..'))throw new Error('Website build has no valid JavaScript entry asset.');
  return entry;
}
export async function main(args=process.argv.slice(2)) {
  if(args[0]==='project') {
    const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
    if(!account || !/^[a-f0-9]{32}$/.test(account) || !token)throw new Error('Cloudflare account and API token must be configured in GitHub Actions.');
    const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${projectName}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`Cloudflare rejected the project lookup (HTTP ${response.status}). Check token account scope and Pages permissions.`);
    const branch=validateProject(await response.json());
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`production_branch=${branch}\n`);
    console.log(`Verified existing Pages project ${projectName}; production branch ${branch}.`);
  } else if(args[0]==='verify') {
    const expected=entryAsset(fs.readFileSync(args[1],'utf8'));
    for(let attempt=0;attempt<6;attempt++) {
      try {
        for(const route of ['/','/tasks']) {
          const url=new URL(route,siteOrigin);url.searchParams.set('__deployment',process.env.GITHUB_SHA ?? 'verify');url.searchParams.set('__attempt',String(attempt));
          const response=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
          if(!response.ok || !response.headers.get('content-type')?.includes('text/html') || entryAsset(await response.text())!==expected)throw Error('Published build is not visible yet.');
        }
        const js=await fetch(new URL(expected,siteOrigin),{signal:AbortSignal.timeout(15000)});
        if(!js.ok || (js.headers.get('content-type')??'').includes('text/html'))throw Error('Published JavaScript asset is not available.');
        console.log(`Verified ${siteOrigin} and /tasks serve this exact build (${expected}).`);
        if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## Website deployment verified\n\n${siteOrigin}\n\nBuild: ${process.env.GITHUB_SHA}\n\nEntry asset: ${expected}\n`);
        return;
      }catch{if(attempt===5)throw Error('Could not verify this build on the production Pages address. Review the Cloudflare deployment before reporting success.');await new Promise(resolve=>setTimeout(resolve,5000));}
    }
  } else throw new Error('Expected project or verify command.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
