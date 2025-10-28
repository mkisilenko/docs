# Anyx Documentation Deployment Guide

## Prerequisites

1. **Mintlify CLI installed:**
   ```bash
   npm install -g mintlify
   ```

2. **GitHub account** with access to push docs repo

3. **Mintlify account** (create at [mintlify.com](https://mintlify.com))

---

## Local Testing

### 1. Navigate to docs directory
```bash
cd temp/anyx-docs
```

### 2. Start local preview server
```bash
mintlify dev
```

This will start a local server at `http://localhost:3000`

### 3. Verify all pages load
Check each page in the navigation:
- ✅ Index (homepage)
- ✅ Quickstart
- ✅ Prompting Guide
- ✅ AI Features
- ✅ Use Cases (all 6 pages)
- ✅ Features
- ✅ Lovable Migration

### 4. Check for broken links
- Click through all internal links
- Verify anchor links work
- Test all CTAs

### 5. Test mobile responsiveness
- Resize browser window
- Check navigation menu
- Verify images scale properly

---

## Deployment Options

### Option A: Mintlify Hosting (Recommended)

#### Step 1: Create GitHub Repository
```bash
cd temp/anyx-docs
git init
git add .
git commit -m "Initial Anyx documentation"
git remote add origin https://github.com/YOUR_ORG/anyx-docs.git
git push -u origin main
```

#### Step 2: Connect to Mintlify
1. Go to [dashboard.mintlify.com](https://dashboard.mintlify.com)
2. Click "Add Documentation"
3. Connect your GitHub repository
4. Select the `anyx-docs` repo
5. Choose branch: `main`
6. Click "Deploy"

#### Step 3: Configure Custom Domain (Optional)
1. In Mintlify dashboard → Settings → Domains
2. Add custom domain: `docs.anyx.app`
3. Update DNS records:
   ```
   Type: CNAME
   Name: docs
   Value: [provided by Mintlify]
   ```
4. Wait for DNS propagation (5-30 minutes)

#### Step 4: Auto-Deployment Setup
- Install [Mintlify GitHub App](https://github.com/apps/mintlify)
- Grant access to `anyx-docs` repository
- Every push to `main` auto-deploys

**Result:** Docs live at `https://docs.anyx.app` or Mintlify subdomain

---

### Option B: Self-Hosted on Vercel

#### Step 1: Build static site
```bash
cd temp/anyx-docs
mintlify build
```

This creates a `.next` folder with static site

#### Step 2: Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd temp/anyx-docs
vercel
```

Follow prompts:
- Link to project? → Yes
- Project name? → `anyx-docs`
- Deploy? → Yes

#### Step 3: Configure custom domain
In Vercel dashboard:
1. Project Settings → Domains
2. Add `docs.anyx.app`
3. Update DNS as instructed

**Result:** Docs live at `https://docs.anyx.app`

---

## Post-Deployment Checklist

### Content
- [ ] All pages render correctly
- [ ] Navigation works properly
- [ ] Search function works
- [ ] All links work (no 404s)
- [ ] Images display properly
- [ ] Mobile layout looks good

### Branding
- [ ] Logo displays correctly
- [ ] Colors match Anyx brand
- [ ] Footer links work
- [ ] Social links correct

### SEO
- [ ] Page titles correct
- [ ] Meta descriptions present
- [ ] Open Graph tags working
- [ ] Favicon shows up

### Analytics (Optional)
- [ ] Google Analytics added
- [ ] Event tracking configured
- [ ] Search tracking enabled

---

## Updating Documentation

### Local Changes
```bash
cd temp/anyx-docs

# Edit files
code index.mdx

# Test locally
mintlify dev

# Commit and push
git add .
git commit -m "Update homepage copy"
git push
```

**Auto-deploys** in 1-2 minutes via Mintlify or Vercel

---

## Maintenance

### Adding New Pages

1. Create new `.mdx` file
2. Add frontmatter:
   ```yaml
   ---
   title: "Page Title"
   description: "Page description"
   ---
   ```
3. Add to `docs.json` navigation
4. Commit and push

### Updating Navigation

Edit `docs.json`:
```json
{
  "navigation": {
    "tabs": [
      {
        "tab": "Guides",
        "groups": [
          {
            "group": "New Section",
            "pages": ["new-page"]
          }
        ]
      }
    ]
  }
}
```

### Changing Branding

Edit `docs.json`:
```json
{
  "name": "Anyx",
  "colors": {
    "primary": "#6366F1",
    "light": "#818CF8",
    "dark": "#4F46E5"
  },
  "logo": {
    "light": "https://anyx.app/logo.png",
    "dark": "https://anyx.app/logo.png"
  }
}
```

---

## Troubleshooting

### "Command not found: mintlify"
```bash
npm install -g mintlify
# or
npx mintlify dev
```

### Images not loading
- Check file path: `/images/filename.png` (not `./images/`)
- Verify file exists in `images/` directory
- Check file extension case sensitivity

### Navigation not updating
- Clear browser cache
- Check `docs.json` syntax (use JSON validator)
- Restart `mintlify dev`

### Build fails
```bash
# Check for errors
mintlify build

# Common issues:
# - Invalid frontmatter YAML
# - Unclosed components (<Card> without </Card>)
# - Invalid JSON in docs.json
```

---

## Support

### Mintlify Resources
- [Documentation](https://mintlify.com/docs)
- [Community](https://mintlify.com/community)
- [GitHub Issues](https://github.com/mintlify/mint)

### Anyx Team
- Discord: #docs-team channel
- Email: docs@anyx.app

---

## Quick Commands Reference

```bash
# Local preview
mintlify dev

# Build for production
mintlify build

# Install CLI
npm install -g mintlify

# Update CLI
npm update -g mintlify

# Check version
mintlify --version
```

---

## Next Steps

1. **Test locally:** `cd temp/anyx-docs && mintlify dev`
2. **Add screenshots:** Replace placeholder images
3. **Deploy:** Push to GitHub and connect to Mintlify
4. **Share:** Announce in Discord, Twitter, etc.
5. **Monitor:** Watch analytics and user feedback
6. **Iterate:** Update based on common questions

---

**🎉 Your Anyx documentation is ready to ship!**

