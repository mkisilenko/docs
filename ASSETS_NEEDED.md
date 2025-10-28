# Assets Needed for Anyx Documentation

## Images Required

### Hero Images
- `images/hero-dark.png` - Main dashboard/product screenshot (dark mode)
- `images/hero-light.png` - Main dashboard/product screenshot (light mode)

### Feature Screenshots
- `images/checks-passed.png` - Success state / completed tasks visualization
- `images/ai-features-hero.gif` - Animated demo of AI features in action
- `images/chat-demo.gif` - Chat interface refining an app
- `images/agent-demo.gif` - AI agent building code
- `images/dashboard-ai-insights.png` - Dashboard with AI insights panel
- `images/ecommerce-ai-assistant.png` - E-commerce site with AI shopping assistant
- `images/blog-ai-assistant.png` - Blog with AI reading assistant
- `images/game-ai-opponent.png` - Game with AI opponent/guide
- `images/landing-ai-assistant.png` - Landing page with AI lead assistant
- `images/productivity-ai-palette.png` - Command palette interface
- `images/landing-page-examples.png` - Gallery of landing pages
- `images/migration-select.png` - Migration wizard screenshot

## Logo Files
- Update `/logo/light.svg` and `/logo/dark.svg` with Anyx logo
- Or keep using `https://anyx.app/logo.png` (currently configured)

## How to Add Images

1. Place images in `temp/anyx-docs/images/` directory
2. Images are referenced in MDX as `/images/filename.png`
3. Use `<Frame>` component to wrap images for proper display

## Temporary Placeholders

Currently using existing Mintlify starter images:
- `/images/hero-dark.png`
- `/images/hero-light.png`
- `/images/checks-passed.png`

Replace these with actual Anyx screenshots before deploying.

## Screenshot Guidelines

### For Product Screenshots:
- **Resolution:** 1920x1080 minimum
- **Format:** PNG for static, GIF for animations (< 5MB)
- **Style:** Clean, professional, show actual product
- **Include:** Real data, not lorem ipsum
- **Highlight:** Key features with subtle annotations

### For GIFs:
- **Duration:** 5-10 seconds max
- **FPS:** 15-20 (keep file size down)
- **Loop:** Yes
- **Optimize:** Use tools like ezgif.com to compress

## Recording Tools

- **Screenshots:** macOS Screenshot (Cmd+Shift+4), Windows Snipping Tool
- **Screen Recording:** Loom, QuickTime, OBS
- **GIF Creation:** Gifox (Mac), ScreenToGif (Windows)
- **Editing:** Figma, Photoshop, or online tools

## Priority Order

1. **High Priority:**
   - `hero-dark.png` and `hero-light.png` (homepage)
   - `chat-demo.gif` (quickstart page)
   - `dashboard-ai-insights.png` (AI features page)

2. **Medium Priority:**
   - All AI feature screenshots
   - Use case example images
   - Migration wizard screenshots

3. **Low Priority:**
   - Additional decorative images
   - Alternative examples
   - Placeholder replacements

## Next Steps

1. Capture screenshots from actual Anyx product
2. Add them to `/images/` directory
3. Verify all image references work
4. Optimize file sizes before deployment
5. Test on local preview (`mint dev`)

