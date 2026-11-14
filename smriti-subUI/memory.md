# Smriti Development Memory

This file records the major project changes and decisions so future work stays consistent.

## 7 November 2026 — Frontend Overhaul

### Major changes

- Replaced the original single transcription card with a complete, scrollable landing page.
- Added a dark heritage-inspired visual system using charcoal, deep green, warm cream, and gold.
- Built a fixed responsive header with Home, Explore, and Contribute navigation.
- Added a full-screen landing section with a temple image, clear calls to action, and a featured silk-weaving story card.
- Added four purpose cards: Capture, Understand, Explore, and Learn.
- Added an Explore section with six visual categories: Traditional Medicine, Monuments, Ancient Texts, Culture, Lifestyle, and Civilisations.
- Kept the existing audio transcription feature and moved it into a polished Contribute section.
- Added responsive phone and tablet layouts, keyboard focus styles, reduced-motion support, and helpful screen-reader labels.
- Added simple JavaScript for the mobile menu, scroll animations, active navigation, category feedback, drag-and-drop uploads, and transcription.
- Downloaded local heritage images so the design does not depend on external image links at runtime.

### Design direction to keep

- Use a cinematic, dark editorial style rather than a generic app dashboard.
- Let the page tell a story as the visitor scrolls from introduction to exploration to contribution.
- Use serif type for heritage-focused headings and simple sans-serif type for controls and explanations.
- Keep interactions calm, purposeful, and easy to understand.

### Technical direction to keep

- Continue using plain HTML, CSS, and JavaScript for the frontend and Python/Flask for the backend.
- Keep code grouped into clearly labelled blocks with student-friendly comments.
- Do not add heavy frameworks unless a future feature truly needs one.

### Next phase ideas

- Create dedicated collection pages, beginning with Monuments.
- Add real story pages and video/audio players for featured traditions.
- Expand category cards into searchable records while keeping the same visual language.

## 7 November 2026 — Direct Microphone Recording

- Added an in-page voice recorder so visitors can speak directly to Smriti instead of creating an audio file first.
- Added start and stop controls, a recording timer, an animated voice indicator, and audio playback before transcription.
- Kept file upload as an alternative and reused the same Flask transcription route for both methods.
- Microphone access is requested only after the visitor presses the record button.

### Recorder reliability update

- Added an immediate secure-address check because browsers block microphones on ordinary HTTP network addresses.
- Added a localhost recovery link for development and clearer messages for denied permission, missing microphones, busy microphones, and empty recordings.
- Added one-second recording chunks and explicit browser error handling so recorded audio is collected more reliably.
- Added a same-site microphone permission header in Flask.
- Fixed an earlier audio-processing timing problem found in the server log.
- Added explicit MIME types (`audio/webm`, `audio/ogg`, `audio/mp4`, etc.) so browser recordings are treated as audio rather than generic files.
- Replaced the browser's white native audio control with a dark custom playback bar that matches the recorder card.
- Fixed the custom player duration showing `Infinity:NaN` for WebM recordings by using the live recording timer whenever browser metadata is unknown.

## 7 November 2026 — Professional Heritage Photography

- Replaced every visible website photograph with a more polished, topic-specific image.
- Chose a calm Golden Temple panorama for the hero so the heading remains easy to read.
- Used authentic Kanchipuram silk-weaving and Indian palm-leaf manuscript photographs where historical accuracy matters.
- Replaced the Taj Mahal on the Civilisations card with Hampi architecture to better match the category's ancient-history focus.
- Kept all images inside `static/assets` so the website still works without loading photographs from external websites.
- Added clear photographer and licence credits in the footer for Unsplash and Wikimedia Commons sources.

## 7 November 2026 — Working Contribution and Approval Journey

- Connected the previously separate API pieces to real visitor-facing pages.
- Added contributor registration and sign-in at `/account` using Flask's signed session cookie instead of an editable user-ID cookie.
- Added `/contributions` so contributors can see drafts, pending reviews, requested changes, administrator feedback, and published work.
- Added reopening and updating for drafts and guides returned with requested changes.
- Added all 10 required data-driven topic pages with separate Curated and Community tabs.
- Kept Curated honest and empty; only administrator-approved Community guides are shown publicly.
- Added `/admin` with a protected review queue, approval, required change feedback, and review-history records.
- Added public guide pages that include materials, tools, steps, context, cultural significance, and optional attribution.
- Added same-origin protection for browser requests that change data and escaped community text before displaying it.
- Fixed submission so a failed approval request is shown as an error rather than incorrectly claiming success.
- Added an automated end-to-end workflow test using a temporary SQLite database.

## 7 November 2026 — Simplified Local Admin and Explore Navigation

- Added a localhost-only administrator shortcut: enter `admin` as the account name and leave the password empty.
- Kept the shortcut unavailable to other computers, even if the development server is visible on a local network.
- Renamed visitor-facing Topics navigation to Explore while keeping old `/topics` links working for compatibility.
- Connected every landing-page heritage card to a real Explore collection and made each full card clickable.
- Reorganized Explore around the six landing groups: Traditional Medicine, Monuments, Ancient Texts, Culture, Lifestyle, and Civilisations.
- Nested the 10 detailed database collections under those six familiar groups so the archive remains precise without feeling confusing.

## 7 November 2026 — Interactive Map and Groq AI Services

- Imported only `map.html`, `map.js`, and the isolated map CSS section from the supplied `smriti (3).zip` archive.
- Preserved the newer homepage, Explore organization, authentication, contributions, and administrator workflow instead of replacing files with older ZIP versions.
- Added `/map` and connected it to the navigation across the existing pages.
- Moved audio transcription to Groq `whisper-large-v3-turbo` while keeping the same recorder and upload interface.
- Replaced the broken guide-generation call with Groq structured output using `openai/gpt-oss-20b` and a strict heritage-guide JSON schema.
- Upgraded the Groq Python library requirement to `groq>=1.7.0` because the previously installed 0.11 client was incompatible with the current HTTP library.
- Added automated tests for the map route, Groq transcription response, and Groq guide response.
- Verified both Groq services with real requests using a short sample transcript and a one-second WAV test.

## 9 November 2026 — Reliable Whisper V3 and Tutorial Generation

- Switched the default transcription model from the faster Turbo variant to Groq `whisper-large-v3` for stronger multilingual accuracy.
- Preserved each recording's filename and media type when sending it to Groq, and added clear checks for empty audio and recordings with no detected speech.
- Reworked the tutorial prompt so practical recordings become ordered instructions while stories and histories become honest learning sequences without invented actions.
- Added server-side validation for every generated tutorial field before the editor opens.
- Fixed the browser so a new recording cannot accidentally reuse an older AI guide, upload errors stay readable, and step warnings remain editable instead of disappearing.
- Added automated checks for the exact Whisper model, silent transcripts, reasoning settings, and incomplete AI output.
- Changed Whisper Large V3 to Groq's audio translation endpoint so non-English recordings become English transcripts before GPT-OSS creates the tutorial.
- Added a connected dark step-card preview based on the approved visual reference and reused it on published guide pages.
- Fixed unsigned draft saves by carrying the tutorial through sign-in, saving it after authentication, and opening My Contributions so the new draft is immediately visible.
- Added `openai/gpt-oss-120b` as a separate transcript-review stage between Whisper and tutorial generation. It removes chatter, organizes productive content, suggests safe missing steps, and visibly records every AI-added detail and unresolved question.
- Fixed long saved guides staying invisible on Edit: restored editors now bypass the scroll-reveal threshold and scroll directly to the editable transcript.
- Added owner-only contribution deletion with confirmation, including clean removal of review history and immediate removal of published guides from Explore.

## 10 November 2026 — Wikimedia Explore Rebuild

- Removed the interactive map route, page, script, and every Map navigation link.
- Rebuilt Explore around live Wikipedia and Wikimedia REST data without requiring an API key.
- Added six curated starting collections: Ancient India, Living Cultures, Heritage Crafts, Traditional Food, Architecture, and Knowledge & Texts.
- Added Wikipedia search, live summaries, Wikimedia thumbnails, direct source links, caching, retry states, and source attribution.
- Kept administrator-approved Smriti community guides visible below the external knowledge collections.
- Limited each Wikipedia card summary to three lines with an accessible Read more and Read less toggle.

## 11 November 2026 — Heritage-101 Map Restoration

- Restored the interactive India heritage atlas from the supplied `smriti (3).zip` without replacing the current homepage, Explore, contribution, or administrator features.
- Added `/map`, map navigation links across every page, all state and union-territory shapes, monument pins, search, filters, state zoom, and monument detail panels.
- Renamed the visitor-facing website from Smriti to Heritage-101 while keeping existing environment-variable and database names compatible.

## 11 November 2026 — Shared Header and Account Menu

- Replaced the separate portal navigation bars with the same header structure and styling used on the homepage.
- Moved My contributions, administrator-only Review contributions, and Sign out into one role-aware account dropdown.
- Kept Review out of the menu for contributors and signed-out visitors while preserving the server-side administrator check.
- Changed the landing-page Heritage-101 wordmark to the same Arial, uppercase, letter-spaced typography used by the hero eyebrow text.

## 11 November 2026 — Draft Login Handoff Repair

- Fixed administrator login ignoring the pending contribution return address and opening the review queue instead.
- Preserved unsigned contribution data in temporary session storage with a local-storage fallback until Flask confirms the draft was saved.
- Restored pending contributions on the homepage even if the exact resume query parameter is lost during authentication.
- Added compatibility for pending drafts stored under the earlier Smriti browser-storage key.
