# Smriti Design Guide

This document explains how Smriti should look and feel as it grows.

Smriti is an app that preserves traditions and helps people discover existing heritage. It should feel like a mixture of:

- A digital archive
- A documentary about real people and places
- A friendly learning website

The website should never feel like a boring database or a generic dashboard.

---

## 1. Main Design Idea

## A Living Archive

Smriti should show that heritage is still alive.

Do not present traditions only as old objects in a museum. Show the people, places, skills, sounds, materials, and stories that keep traditions active today.

Every important story should answer at least one of these questions:

- Who practises this tradition?
- Where does it come from?
- What materials or tools are used?
- What story does it carry?
- How can people learn more?

---

## 2. Visual Mood

The website should feel:

- Warm
- Respectful
- Cinematic
- Thoughtful
- Human
- Curious

Use large photographs, calm spacing, and warm gold highlights. Avoid loud colours, cluttered screens, and too many effects.

The current dark theme should remain the main visual identity.

---

## 3. Colour Palette

Use these colours throughout the website.

| Purpose | Colour | Hex code |
| --- | --- | --- |
| Main background | Charcoal | `#090C0B` |
| Secondary background | Deep forest green | `#163C30` |
| Card background | Dark green-black | `#171C18` |
| Main accent | Warm gold | `#E9AE5D` |
| Bright accent | Light gold | `#FFD892` |
| Main text | Warm cream | `#F7F0E3` |
| Secondary text | Muted cream | `#C8C0B2` |
| Borders | Soft transparent cream | `rgba(242, 223, 189, 0.18)` |

### Colour rules

- Use charcoal for the main page background.
- Use forest green for buttons, tags, and highlighted cards.
- Use gold for buttons, important numbers, icons, and active links.
- Use cream for headings and readable text.
- Do not use gold for every piece of text. It should remain special.

---

## 4. Typography

Use two simple font styles.

### Headings

Use a serif font such as Georgia.

Headings should feel connected to books, history, and storytelling.

Examples:

- `Preserve. Learn. Continue.`
- `Explore our heritage`
- `Every memory begins with someone speaking.`

### Body text and buttons

Use Arial, Inter, or another simple sans-serif font.

This keeps instructions, buttons, and descriptions easy to read.

### Text rules

- Keep paragraphs short.
- Explain difficult words.
- Do not use unnecessary academic language.
- Use italic serif text for short quotes or place descriptions.
- Use uppercase labels only for small category names.

---

## 5. Homepage Structure

The homepage should be one smooth scrollable story.

### Section 1: Hero

Purpose: Introduce Smriti quickly.

Include:

- A full-screen heritage photograph or slow background video.
- The main heading: `Preserve. Learn. Continue.`
- One short explanation.
- `Explore traditions` button.
- `Record a story` button.

The hero should immediately explain that Smriti preserves real cultural knowledge.

### Section 2: Featured living tradition

Purpose: Show one real example.

Include:

- A large photograph or video card.
- Tradition name.
- State, city, or region.
- Play button.
- Short description.

Example:

```text
Kanchipuram Silk Weaving
Tamil Nadu
Learn how generations of weavers create silk by hand.
```

### Section 3: What Smriti does

Use four simple cards:

1. **Capture** — Record people and their knowledge.
2. **Understand** — Turn recordings into clear notes and transcripts.
3. **Explore** — Discover connections between places and traditions.
4. **Learn** — Follow stories and practical explanations.

### Section 4: Explore heritage

Use visual cards for:

- Traditional Medicine
- Monuments
- Ancient Texts
- Culture
- Lifestyle
- Civilisations

Every card should have:

- A relevant image
- A clear title
- One short description
- A small arrow button

### Section 5: Record a story

Purpose: Let visitors contribute directly.

Include:

- A large microphone button.
- Start and stop controls.
- Recording timer.
- Playback control.
- Transcribe button.
- Upload option for existing recordings.
- A short privacy and consent explanation.

### Section 6: Closing message

End with a memorable sentence:

> Heritage lives when knowledge keeps moving.

Then show links to Explore and Contribute.

---

## 6. Tradition Detail Page

Every tradition page should use the same structure.

### Header area

Show:

- Tradition name
- Region
- Category
- Large image
- Short introduction

### Story area

Show:

- Audio or video recording
- Speaker name
- Speaker location
- Language
- Transcript

### Learning area

Explain:

- How the tradition works
- Tools or materials used
- Important steps
- How it is taught
- How it is changing today

### Related stories

Show three related cards:

- Similar tradition
- Related place
- Related material or craft

---

## 7. Monument Page

A monument page should include:

- Large image
- Name and location
- Construction period or historical period
- Short historical summary
- Architectural details
- Local stories
- Audio guide
- Map link
- Nearby traditions

Keep history easy to understand. Use a timeline instead of one large block of text.

---

## 8. Community Voice Page

This page should focus on people.

Possible contributors:

- Artisans
- Elders
- Teachers
- Performers
- Local historians
- Students

Each recording should show:

- Person's name
- Place
- Language
- Tradition
- Recording date
- Consent status

Never publish a person's recording without permission.

---

## 9. Search and Filters

Add these after the first detail page works.

Visitors should be able to search by:

- Tradition
- Place
- State
- Language
- Category
- Material

Useful filters:

- All traditions
- Nearby places
- Audio available
- Video available
- Beginner friendly
- Recently added

Keep filters simple. Do not make visitors fill out a complicated form.

---

## 10. Interactive Map

The map should connect places to traditions.

Example:

```text
Kanchipuram
→ Silk weaving
→ Silk and zari
→ Weaver families
→ Oral craft knowledge
```

When someone selects a location, show a small card with:

- Place name
- Main traditions
- Available stories
- Explore button

Build the map only after the basic cards and detail pages are working.

---

## 11. Knowledge Graph

The knowledge graph can show connections like:

```text
Place → Tradition → Material → Community → Story
```

Example:

```text
Varanasi → Silk weaving → Silk thread → Weaver families → Recorded interview
```

Start with a simple visual diagram. Do not build a complicated graph system at the beginning.

---

## 12. Reusable Components

Build these as repeated design patterns:

- Navigation header
- Gold primary button
- Outline secondary button
- Image story card
- Heritage category card
- Audio player
- Recording panel
- Timeline item
- Location tag
- Language tag
- Contributor card
- Related-story card

If a component appears more than once, keep its style consistent everywhere.

---

## 13. Imagery Rules

Use photographs that show the actual subject.

Good images include:

- People practising a craft
- Tools and materials
- Buildings and monuments
- Manuscripts and objects
- Performances
- Everyday life

Avoid:

- Random stock photos
- Images that do not match the category
- Overly polished images that feel disconnected from real communities
- Images without a source or licence

Every external image should have a credit and licence note.

Keep images in `static/assets` so the website can still work when external links are unavailable.

---

## 14. Motion and Interaction

Use motion gently.

Good motion:

- Cards rising slightly on hover
- Sections fading in while scrolling
- Audio bars moving during recording
- Smooth scrolling between sections
- Image zooming slightly on hover

Avoid:

- Flashing elements
- Large distracting animations
- Autoplay audio
- Fast page transitions

Always support people who prefer reduced motion.

---

## 15. Accessibility Rules

- Every important image needs useful alternative text.
- Buttons must explain what they do.
- Keyboard users must be able to use the entire page.
- Text must have strong contrast against the background.
- Never communicate meaning using colour alone.
- Audio and video should have text alternatives where possible.
- Microphone permission must only be requested after a user presses Record.
- Explain clearly when microphone access is unavailable.

---

## 16. Content Rules

- Use real people, places, and sources.
- Do not invent statistics, testimonials, or historical facts.
- Treat living communities with respect.
- Explain unfamiliar terms in plain language.
- Include the contributor's permission before publishing recordings.
- Mention the source of historical information.
- Show that traditions can change over time.

---

## 17. Implementation Order

Build features in this order:

1. Keep improving the homepage.
2. Build one excellent tradition detail page.
3. Add real audio and video story playback.
4. Add category search and filters.
5. Add contributor profiles.
6. Add the interactive India map.
7. Add the knowledge graph.
8. Add bookmarks and personal learning paths.

Do not build everything at once. Finish and test each stage before starting the next.

---

## 18. Simple Technical Rules

- Use plain HTML, CSS, and JavaScript.
- Use Python and Flask for backend features.
- Keep code blocks small and clearly commented.
- Use simple names for files and variables.
- Prefer reusable CSS classes.
- Keep external libraries to a minimum.
- Test the page on a phone and a laptop.
- Test microphone permission, recording, playback, upload, and transcription separately.

The final Smriti experience should feel like:

> A documentary, an archive, and a learning journey in one place.
