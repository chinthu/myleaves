# GitHub Pages Deployment Guide

## Setup Instructions

1. **Enable GitHub Pages**
   - Go to your repository Settings → Pages
   - Under "Build and deployment":
     - Source: **GitHub Actions** (NOT "Deploy from a branch")
   
2. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Configure GitHub Pages deployment"
   git push origin master
   ```

3. **Monitor Deployment**
   - Go to the "Actions" tab in your repository
   - Watch the workflow run
   - Once complete, your app will be available at:
     `https://<username>.github.io/<repository-name>/`

## Important Notes

- The workflow automatically runs on every push to the `master` branch
- The build output is from `dist/myleaves/browser/`
- The app is deployed with base href set to `/<repository-name>/`
- Angular routing is handled with a 404.html fallback
- `.nojekyll` file is included to prevent Jekyll processing

## Troubleshooting

**If deployment fails:**
1. Check the Actions tab for error logs
2. Ensure you have enabled GitHub Pages with source "GitHub Actions"
3. Verify Node.js 22 is compatible with your dependencies
4. Check that `npm ci` and `npm run build` work locally

**If app shows blank page:**
1. Check browser console for errors
2. Verify the base href matches your repository name
3. Ensure all API endpoints are configured correctly
4. Update Supabase CORS settings to allow your GitHub Pages URL
