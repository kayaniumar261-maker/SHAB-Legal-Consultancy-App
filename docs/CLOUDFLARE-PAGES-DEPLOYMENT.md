# Website deployment from GitHub

Production source: `shab-2.0`. Target: https://shab-legal-consultancy-app.pages.dev

Application Quality checks the app, builds it with the production Supabase secrets, and uploads the verified artifact directly to the existing Cloudflare Pages project. No browser ZIP upload or new Pages project is required. The separate Worker configuration is intentionally excluded from the Pages deployment directory.

## One-time connection

Add repository Actions secret `CLOUDFLARE_API_TOKEN`: a Cloudflare API token scoped to account `f73eb9ad75202030f02bb3339d01a045`, with Account / Cloudflare Pages / Edit permission. Keep the token in GitHub secrets; never commit it or paste it into chat.

If the token is missing, the deployment job reports deployment pending and skips the upload. A successful build alone does not mean the website was deployed.

After adding the secret, rerun the deployment job from the latest successful Application Quality push run on `shab-2.0`. Artifacts are retained for 14 days; if expired, rerun all jobs to rebuild them. Older commits are rejected when a newer production commit exists.

The job checks the existing project name and domain, obtains its actual production branch, deploys the build, and verifies that both `/` and `/tasks` return the exact expected JavaScript entry asset. It also checks the entry asset is available. This verifies deployment and SPA routing, not authenticated business operations.

The desktop release is separate. Email delivery still requires its sender and scheduler configuration; WhatsApp messages remain manual actions requiring the person to press Send.
