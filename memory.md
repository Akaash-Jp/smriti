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
- Fixed a Gemini timing race found in the server log: newly recorded files are now polled until their state becomes `ACTIVE` before transcription begins.
- Added explicit MIME types during Gemini upload (`audio/webm`, `audio/ogg`, `audio/mp4`, etc.) so browser recordings are treated as audio rather than generic files.
- Replaced the browser's white native audio control with a dark custom playback bar that matches the recorder card.
- Fixed the custom player duration showing `Infinity:NaN` for WebM recordings by using the live recording timer whenever browser metadata is unknown.

## 7 November 2026 — Professional Heritage Photography

- Replaced every visible website photograph with a more polished, topic-specific image.
- Chose a calm Golden Temple panorama for the hero so the heading remains easy to read.
- Used authentic Kanchipuram silk-weaving and Indian palm-leaf manuscript photographs where historical accuracy matters.
- Replaced the Taj Mahal on the Civilisations card with Hampi architecture to better match the category's ancient-history focus.
- Kept all images inside `static/assets` so the website still works without loading photographs from external websites.
- Added clear photographer and licence credits in the footer for Unsplash and Wikimedia Commons sources.
