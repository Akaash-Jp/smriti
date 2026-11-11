import json
import os
import tempfile
import time

from flask import Flask, request, jsonify
from flask import send_from_directory
from dotenv import load_dotenv
from google import genai

# Load secret settings from the local .env file before creating the AI client.
load_dotenv()

# Flask serves the website files from the static folder.
app = Flask(__name__, static_folder="static")

# A 20 MB limit prevents visitors from accidentally uploading very large files.
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

# This client connects the transcription route to Google's Gemini service.
client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY", "")
)


# Gemini may need a few seconds to prepare a newly uploaded recording.
# This helper waits until the file is safe to use for transcription.
def wait_for_active_file(uploaded_file, timeout_seconds=60):
    deadline = time.monotonic() + timeout_seconds
    current_file = uploaded_file

    while True:
        state = getattr(current_file, "state", None)
        state_name = getattr(state, "name", None)

        if state_name == "ACTIVE":
            return current_file

        if state_name == "FAILED":
            raise RuntimeError("Gemini could not prepare the audio file")

        if time.monotonic() >= deadline:
            raise TimeoutError("Gemini took too long to prepare the audio file")

        # Wait briefly before asking Gemini for the file's latest state.
        time.sleep(1)
        current_file = client.files.get(name=current_file.name)


# Send the main HTML page when someone visits the website address.
@app.route("/")
def home():
    return send_from_directory("static", "index.html")


# Send the interactive India heritage map page when someone visits /map.
@app.route("/map")
def map_page():
    return send_from_directory("static", "map.html")


# Tell browsers that this website is allowed to request its own microphone.
# HTTPS (or localhost during development) is still required by the browser.
@app.after_request
def allow_same_site_microphone(response):
    response.headers["Permissions-Policy"] = "microphone=(self)"
    return response


@app.route("/api/process", methods=["POST"])
def process_audio():
    # Read the audio file included in the form submission.
    audio = request.files.get("audio")

    if not audio or not audio.filename:
        return jsonify({"error": "No audio selected"}), 400

    # Only allow the recording formats shown to visitors on the page.
    suffix = os.path.splitext(audio.filename)[1].lower()

    allowed = {".mp3", ".wav", ".webm", ".ogg", ".m4a", ".mp4"}
    if suffix not in allowed:
        return jsonify({"error": "Unsupported audio format"}), 400

    path = None

    try:
        # Save a temporary copy because the Gemini upload tool needs a file path.
        with tempfile.NamedTemporaryFile(
            suffix=suffix, delete=False
        ) as temp:
            audio.save(temp)
            path = temp.name

        # Upload the recording with an explicit audio MIME type.
        # Browser recordings can otherwise be misclassified as generic data.
        mime_types = {
            ".mp3": "audio/mpeg",
            ".wav": "audio/wav",
            ".webm": "audio/webm",
            ".ogg": "audio/ogg",
            ".m4a": "audio/mp4",
            ".mp4": "audio/mp4",
        }
        uploaded = client.files.upload(
            file=path,
            config={"mime_type": mime_types[suffix]},
        )

        # A browser recording is often still PROCESSING immediately after upload.
        # Waiting here prevents Gemini's "file is not ACTIVE" error.
        uploaded = wait_for_active_file(uploaded)

        result = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                "Transcribe this recording accurately. "
                "Preserve the original spoken language. "
                "Return only the transcript.",
                uploaded
            ]
        )

        # Return the finished transcript to the JavaScript on the page.
        return jsonify({
            "success": True,
            "transcript": result.text
        })

    except TimeoutError:
        app.logger.exception("Audio processing timed out")
        return jsonify({
            "error": "The recording took too long to prepare. Please try again."
        }), 504

    except Exception:
        # Keep technical details in the server log and show a simple message online.
        app.logger.exception("Transcription failed")
        return jsonify({
            "error": "Transcription failed. Check the server terminal."
        }), 500

    finally:
        # Delete the temporary recording whether the request succeeds or fails.
        if path and os.path.exists(path):
            os.remove(path)


# Start the development server only when this file is run directly.
if __name__ == "__main__":
    app.run(debug=True)
