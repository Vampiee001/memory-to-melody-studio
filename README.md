# Memory To Melody Studio

Build a polished, mobile-first full-stack web app called "MemoryMelody" that turns a user's photos and videos into a personal original song and guides release/monetization on Spotify. Make the UI feel premium, cinematic, emotionally warm: midnight charcoal/navy, violet and warm gold accents, large rounded cards, subtle audio-wave visuals, clean typography. This is a functional MVP, not just a landing page.

Core flow:
1) Dashboard with "Create a song from your memories" CTA and project/library cards.
2) New song studio: upload multiple photos and video clips (show thumbnails/previews, remove/reorder, upload progress, file validation); user can also type context and select mood (nostalgic, joyful, romantic, triumphant, bittersweet), genre (pop, acoustic, R&B, hip-hop, cinematic, country, OPM/Bisaya), vocal preference, language, song length. Ask for consent to process uploaded media and remind user to upload only media they have rights/permission to use.
3) Analyze memories: create an experience summary from user-provided caption/context and uploaded file metadata/available image understanding if supported. Do not pretend video/audio analysis is running if no provider is configured. Use a clear provider abstraction and configuration screen for AI services. Generate an editable song concept, title, original lyrics with verse/pre-chorus/chorus/bridge, and a music-generation prompt. Add regenerate/edit controls.
4) Audio generation: build a provider adapter interface and configuration UI for an external music-generation API, with secure server-side secret handling; if no API key/provider is configured, show a clear setup state and allow exporting lyrics + music prompt. Do not expose secrets client-side or fake generated audio. If configured, call the provider from a server/edge function, show job status, audio preview player, download/export. Include rights/licensing checklist before release.
5) Release preparation: artist name, track title, release date, language, explicit-content flag, songwriter/producer credits, cover-art upload/generation placeholder, audio file, lyrics, ownership declaration. Create a release checklist and downloadable release package metadata (CSV/JSON and text lyrics where practical).
6) Spotify release: Be truthful: Spotify does not generally let arbitrary third-party apps upload tracks directly; distribution is normally through an approved music distributor. Build a "Connect Spotify for Artists" informational/authorized connection section and a distributor handoff page. Provide links to Spotify's official provider directory and Spotify for Artists. Design a distributor integration adapter that can be wired to a distributor API if the user has an eligible approved API account; do not claim auto-upload works without API access. Default to an explicit final user review/confirmation before any submission. Show statuses: Draft, Ready to distribute, Submitted, Live. Do not use Spotify Web API playback scopes as if they upload music.
7) Account/library: persist user projects and status securely using app's supported database/auth if available. Use a friendly empty state and sample demo project clearly marked as demo. Responsive on phone.
8) Add onboarding/settings for AI provider and distributor integration; never hardcode API secrets. Add robust errors, loading states, accessibility, and privacy controls including deleting projects/uploads.

Technical: use the platform's default stack. Implement a working front end and data model. Use real functionality where available; clearly label integrations requiring external API keys/partner access rather than faking them. Keep UI cohesive and polished. The main CTA should lead through the flow. Include a disclaimer that AI-generated content rights depend on the provider's terms and that the user must verify ownership/permissions before commercial distribution.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://memory-to-melody-studio.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/19765ae4-f18c-4242-98b9-fbc04e391230).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
