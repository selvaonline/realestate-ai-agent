# Sales Deck Conversion Guide

## How to Convert SALES_DECK.md to PowerPoint/Google Slides

### Method 1: Using Pandoc (Recommended)

**Install Pandoc:**
```bash
# Mac
brew install pandoc

# Windows (with Chocolatey)
choco install pandoc
```

**Convert to PowerPoint:**
```bash
pandoc SALES_DECK.md -o SALES_DECK.pptx -t pptx
```

**Convert to Google Slides:**
1. Convert to PPTX first (above)
2. Upload to Google Drive
3. Open with Google Slides
4. File → Make a copy

---

### Method 2: Using Slides.com or Beautiful.ai

1. Copy the markdown content
2. Go to [Slides.com](https://slides.com) or [Beautiful.ai](https://beautiful.ai)
3. Create new presentation
4. Paste sections slide by slide
5. Apply professional template

---

### Method 3: Manual PowerPoint Creation

#### Step-by-Step:

1. **Open PowerPoint** → Blank Presentation

2. **Choose a Professional Theme:**
   - Design → Themes → "Ion" or "Facet" (recommended)
   - Or download PGIM corporate template if available

3. **Create Slides from Markdown:**
   Each `## Slide X:` section = one slide

4. **Recommended Layout for Each Slide:**
   - **Title Slide (Slide 1)**: Title + Subtitle layout
   - **Problem/Solution (Slides 2-3)**: Title + Content
   - **Demo (Slide 4)**: Title + Content with screenshot
   - **Features (Slides 5-8)**: Two Content layout (icons + text)
   - **Comparison (Slide 9)**: Title + Table
   - **Testimonials (Slide 19)**: Quote layout with attribution
   - **CTA (Slide 20)**: Title + Content with contact info

5. **Add Visual Elements:**
   - Icons from [flaticon.com](https://flaticon.com) or [fontawesome.com](https://fontawesome.com)
   - Screenshots from your app (http://localhost:4200)
   - Charts for metrics (Slide 10)
   - Photos from [unsplash.com](https://unsplash.com) (search "commercial real estate")

---

### Quick PowerPoint Styling Guide

#### Color Palette (Match UI)
- **Primary Blue**: RGB(47, 92, 255) or #2f5cff
- **Dark Background**: RGB(11, 15, 20) or #0b0f14
- **Light Text**: RGB(233, 238, 245) or #e9eef5
- **Accent Green**: RGB(95, 200, 143) or #5fc88f

#### Fonts
- **Headers**: Segoe UI Bold, 36-44pt
- **Subheaders**: Segoe UI Semibold, 24-28pt
- **Body**: Segoe UI Regular, 18-20pt
- **Small text**: Segoe UI Regular, 14-16pt

#### Slide Layout Tips
- **Margins**: 1 inch on all sides
- **Logo**: Top-left or bottom-right (70x70px)
- **Slide numbers**: Bottom-right corner
- **Consistent spacing**: Use PowerPoint's alignment guides

---

### Method 4: Using AI Tools

**Option A: ChatGPT + DALL-E**
1. Upload SALES_DECK.md to ChatGPT
2. Ask: "Convert this to PowerPoint slide content with visual suggestions"
3. Generate images with DALL-E for concepts

**Option B: Gamma.app (AI Presentation Generator)**
1. Go to [gamma.app](https://gamma.app)
2. Paste sections of SALES_DECK.md
3. Let AI generate beautiful slides
4. Export to PowerPoint

**Option C: Tome.app**
1. Go to [tome.app](https://tome.app)
2. Use "Import from Document"
3. Upload SALES_DECK.md
4. AI generates slides with images

---

### Essential Screenshots to Capture

**From Your App (http://localhost:4200):**

1. **Homepage with Query**
   - Show: "Find CVS properties in Dallas under $5M with 6%+ cap"
   - For: Slide 3 (Solution)

2. **Thinking Steps in Action**
   - Show: 🔍 icons with "Searching...", "Analyzing..."
   - For: Slide 4 (Demo)

3. **Answer with Sources**
   - Show: Streaming answer with [1], [2], [3] citations
   - For: Slide 5 (Capabilities)

4. **Deal Card with Screenshot**
   - Show: Property details, price, cap rate, underwriting
   - For: Slide 6 (Features)

5. **Sources Section**
   - Show: Numbered sources with URLs
   - For: Slide 5 (Capabilities)

6. **Share Button**
   - Show: 🔗 Share Results button clicked
   - For: Slide 6 (Features)

**Screenshot Tips:**
- Use full-width browser window (1920px)
- Clean up browser toolbars (Cmd+Shift+F for fullscreen)
- Wait for all content to load
- Crop to relevant section in PowerPoint

---

### Pre-Made Template Recommendations

**Professional Templates (Free):**
1. **Pitch** by Slidebean - Clean, modern
2. **Startup** by SlidesGo - Tech-focused
3. **Business Plan** by Canva - Professional

**Premium Templates ($):**
1. **Pitch Deck** by Envato Elements - $16.50/month
2. **Investor Pitch** by Creative Market - $24
3. **PGIM-style Corporate** - Check PGIM brand guidelines

---

### Slide-by-Slide Visual Suggestions

| Slide | Visual Element | Source |
|-------|---------------|--------|
| 1 (Title) | Hero image of modern office | Unsplash |
| 2 (Problem) | Frustrated person at computer | Flaticon sad face icon |
| 3 (Solution) | Clean screenshot of app | Your app |
| 4 (Demo) | GIF or video of search | Screen recording |
| 5 (Capabilities) | 4 icons for 4 features | Flaticon |
| 6 (Features) | App screenshots in frames | Your app |
| 7 (Tech Stack) | Architecture diagram | Draw.io or Lucidchart |
| 8 (Use Cases) | 3 example properties | Property photos |
| 9 (Comparison) | Table with checkmarks | Built-in PowerPoint |
| 10 (Results) | Bar chart of metrics | Excel → PowerPoint |
| 11 (Security) | Shield icon + checkmarks | Flaticon |
| 12 (Pricing) | 3-column pricing table | Built-in PowerPoint |
| 13 (Roadmap) | Timeline graphic | PowerPoint SmartArt |
| 14 (Implementation) | Gantt chart or phases | PowerPoint SmartArt |
| 15 (Case Study) | Quote with headshot (generic) | Unsplash + text |
| 16 (Why Now) | Upward trending graph | Excel → PowerPoint |
| 17 (About) | Team photos (generic) | Unsplash "business team" |
| 18 (FAQ) | Q&A icons | Flaticon question mark |
| 19 (Social Proof) | 5-star reviews layout | Custom design |
| 20 (CTA) | Large contact info + QR code | QR code generator |

---

### Animation Suggestions

**Subtle Animations (Professional):**
- **Entrance**: Fade (all text elements)
- **Emphasis**: None (too distracting)
- **Exit**: None
- **Transitions**: Morph or Fade (between slides)

**Timing:**
- Entrance: 0.5 seconds
- Advance: On click (not automatically)

**Animation Guidelines:**
- Less is more for B2B/institutional
- Only animate key points or numbers
- Never animate bullet points one-by-one (dated)

---

### Speaker Notes Template

For each slide, add speaker notes in PowerPoint:

```
## Slide X: [Title]

### Key Points to Mention:
- [Point 1]
- [Point 2]
- [Point 3]

### Transitions:
"Now that we've covered X, let's look at Y..."

### Questions to Anticipate:
- Q: [Likely question]
  A: [Your answer]

### Timing: [X] minutes
```

---

### Export Settings

**For Presentation:**
- Format: PowerPoint (.pptx)
- Fonts: Embed fonts (File → Options → Save)
- Resolution: High quality (220 ppi)
- Media: Embed all images

**For PDF Handout:**
- File → Export → PDF
- Options: Include hidden slides = No
- Quality: Standard (for email) or High (for print)

**For Video Recording:**
- Slide Show → Record Slide Show
- Export as MP4 (1080p)
- Narration: Optional

---

### Final Checklist

Before presenting:
- [ ] All screenshots are high quality
- [ ] All URLs work (if clickable)
- [ ] Contact information is correct
- [ ] Slide numbers present (except title slide)
- [ ] Consistent font sizes
- [ ] No spelling errors (F7 spell check)
- [ ] Animations preview correctly
- [ ] Backup copy saved to USB drive
- [ ] Presenter notes printed
- [ ] Demo app is running (http://localhost:4200)
- [ ] Test on presentation computer/projector

---

### Presentation Day Tips

1. **Arrive early** - Test laptop, projector, clicker
2. **Presenter mode** - Use dual screen with speaker notes
3. **Demo ready** - Have app open in browser tab
4. **Backup plan** - PDF version if tech fails
5. **Practice** - Rehearse 3-5 times (aim for 20-25 min)
6. **Pause on key slides** - Let important points sink in
7. **Eye contact** - Look at audience, not slides
8. **Energy** - Match enthusiasm to client's vibe

---

### Post-Presentation

**Follow-up Assets to Prepare:**
- PDF version of deck (email-friendly)
- Demo video recording (2-3 minutes)
- One-pager summary (Slide 3 + 9 + 20)
- Trial access credentials (if they commit)

**Send within 24 hours:**
```
Subject: RealEstate AI Agent - Demo Follow-up for PGIM

Hi [Name],

Thank you for your time today. As promised, here are the materials:

1. Presentation deck (PDF attached)
2. Demo video: [YouTube/Loom link]
3. Free trial access: [Link with credentials]
4. Technical documentation: [Link]

I'm available for any questions at [phone] or [email].

Next step: [Specific action item from meeting]

Best,
[Your Name]
```

---

## Need Help?

**Resources:**
- PowerPoint tutorials: [LinkedIn Learning](https://linkedin.com/learning)
- Design inspiration: [SlidesGo](https://slidesgo.com)
- Icons: [Flaticon](https://flaticon.com)
- Images: [Unsplash](https://unsplash.com)

**Quick Support:**
If you need help with specific slides, I can provide:
- Detailed speaker notes
- Visual layout suggestions
- Animation recommendations
- Data visualization help

Just ask! 🚀
