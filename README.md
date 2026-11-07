# Smriti

Smriti is a simple heritage website for discovering, documenting, and learning about India's living traditions.

## Project Structure

- `static/index.html` contains the page content.
- `static/style.css` controls colours, spacing, layouts, and responsive design.
- `static/script.js` controls the menu, scroll effects, file selection, and transcription request.
- `static/portal.js` controls sign-in, Explore collections, contribution status, public guides, and administrator review.
- `static/portal.css` gives the workflow pages the same dark heritage style.
- `static/assets/` contains the heritage photographs used by the page.
- `app.py` runs the Flask web server and sends recordings to Gemini for transcription.
- `AGENTS.md` contains the coding and documentation rules for this project.
- `memory.md` records major design and development decisions.

## Run the Website

1. Create a `.env` file and add a valid `GEMINI_API_KEY`.
   Add a long random `SMRITI_SECRET_KEY` before using the site outside local development.
2. Install the packages listed in `requirements.txt`.
3. Run `python app.py`.
4. Open `http://127.0.0.1:5000` in a browser.

The frontend uses only HTML, CSS, and JavaScript. Visitors can record from their microphone or upload an existing audio file. Python and Flask provide the small backend needed for transcription.

## If the Microphone Does Not Open

- On the same computer as Flask, open `http://127.0.0.1:5000`. Browsers allow microphones on localhost.
- Do not use an address such as `http://192.168.1.5:5000` for microphone recording. A network address needs HTTPS.
- If the browser previously blocked access, use the lock icon beside the address, allow **Microphone**, and reload the page.
- Open the site in a normal browser tab instead of an embedded preview panel.
- Close other calling or recording apps if they are already using the microphone.

The page now shows a specific message for each of these situations.

After a recording reaches Flask, the backend waits for Gemini to finish preparing the file before asking for a transcript. This avoids the `File is not in an ACTIVE state` error that can happen with fresh browser recordings.

The recorder also sends an explicit audio MIME type to Gemini and uses a custom dark playback control instead of the browser's default white audio box.

## Heritage guide workflow

The transcription result now has **Generate step-by-step guide**. It sends only the editable transcript to Gemini, then displays an editable guide preview. A contributor selects a topic, adds attribution and publication consent, and saves a draft or submits it for review.

The new workflow uses SQLite in `smriti.db`, created automatically on startup. Authentication endpoints are available at `/api/auth/register`, `/api/auth/login`, and `/api/auth/logout`. Create the first administrator with:

```text
python app.py create-admin admin@example.com choose-a-strong-password
```

The visible workflow pages are:

- `/account` — register or sign in.
- `/contributions` — see drafts, review status, feedback, and published guides.
- `/explore` or `/explore/textiles` — browse six familiar heritage groups and their 10 detailed collections.
- `/admin` — review submitted guides as an administrator.
- `/guides/1` — read a published community guide (replace `1` with its ID).

Published contributions only appear through public topic pages after administrator approval. The Curated tab is intentionally an honest empty state.

## Test the workflow

Run the automated journey check with:

```text
python -m unittest discover -s tests -v
```

The test uses a temporary database and proves that registration, draft saving, submission, administrator approval, topic assignment, and public visibility work without changing the real archive.
