# Marketing assets: A Team / Komunitas

| File | What it is |
|---|---|
| `a-team-logo.svg` / `.png` | A Team logo: a cream "A" with a smile crossbar on an orange gradient tile (PNG 512×512, transparent) |
| `capstone-a-team-flyer.png` | Summary of the setup and release (Set up → Secured → Checked → Live), 2160×2700 |
| `komunitas-threads-flyer.png` | Public flyer for Threads/Instagram: headline, features, QR code, 2160×2700 (4:5) |
| `capstone-a-team-deck.pptx` | 7-slide 16:9 deck with speaker notes (setup and release) |
| `komunitas-project-deck.pptx` | 24-slide 16:9 project deck with speaker notes: aim and goals, how to use it, architecture and stack, data stores, security, results and next steps |
| `PITCH DECK CAPSTONE.pptx` | The same deck in Bahasa Indonesia (slides and speaker notes) |
| `deck-assets/landing.png`, `landing-id.png` | Screenshots of the live landing page (English, Indonesian), used in the project decks |
| `flyer.html`, `threads-flyer.html` | Editable sources for the two flyers |
| `scripts/` | Rebuild scripts |

Palette (same as the app): cream `#FFF8ED`, warm `#F8E8D0`, peach `#FED7AA`, orange `#F97316`, deep orange `#C2410C`, ink `#292524`. The flyers use the Plus Jakarta Sans font; the deck uses Arial so it looks the same on every computer.

## Regenerate
```bash
cd flyer/scripts
npm install          # first time only
node build-deck.js           # capstone-a-team-deck.pptx
node build-project-deck.js      # komunitas-project-deck.pptx (English)
node build-project-deck.js id   # PITCH DECK CAPSTONE.pptx (Bahasa Indonesia)
sh render-flyers.sh  # flyer PNGs and logo PNG (needs Google Chrome)
```
The QR codes point to https://komunitasa.vercel.app. Scan one with a phone before publishing.
