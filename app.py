
import os
import tempfile

from flask import Flask, request, jsonify
from flask import send_from_directory
from dotenv import load_dotenv
from google import genai

load_dotenv()

app = Flask(__name__, static_folder="static")
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"]
)

@app.route("/")
def home():
    return send_from_directory("static", "index.html")


@app.route("/api/process", methods=["POST"])
def process_audio():
    audio = request.files.get("audio")

    if not audio or not audio.filename:
        return jsonify({"error": "No audio selected"}), 400

    suffix = os.path.splitext(audio.filename)[1].lower()

    allowed = {".mp3", ".wav", ".webm", ".m4a", ".mp4"}
    if suffix not in allowed:
        return jsonify({"error": "Unsupported audio format"}), 400

    path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix, delete=False
        ) as temp:
            audio.save(temp)
            path = temp.name

        uploaded = client.files.upload(file=path)

        result = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                "Transcribe this recording accurately. "
                "Preserve the original spoken language. "
                "Return only the transcript.",
                uploaded
            ]
        )

        return jsonify({
            "success": True,
            "transcript": result.text
        })

    except Exception:
        app.logger.exception("Transcription failed")
        return jsonify({
            "error": "Transcription failed. Check the server terminal."
        }), 500

    finally:
        if path and os.path.exists(path):
            os.remove(path)


if __name__ == "__main__":
    app.run(debug=True)
