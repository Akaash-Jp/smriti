
import os
import tempfile
import time
import json
import secrets
import sqlite3
from datetime import datetime, timezone
from functools import wraps
from urllib.parse import urlsplit
from werkzeug.security import generate_password_hash, check_password_hash

from flask import Flask, request, jsonify, session
from flask import send_from_directory
from dotenv import load_dotenv
from google import genai

# Load secret settings from the local .env file before creating the AI client.
load_dotenv()

# Flask serves the website files from the static folder.
app = Flask(__name__, static_folder="static")

# A 20 MB limit prevents visitors from accidentally uploading very large files.
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024
app.secret_key = os.environ.get("SMRITI_SECRET_KEY", "dev-only-change-this-secret")
# These cookie settings keep login data private and block common cross-site use.
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("SMRITI_HTTPS", "0") == "1"
DATABASE_PATH = os.path.join(os.path.dirname(__file__), "smriti.db")

TOPICS = [
    ("food", "Food & Traditional Recipes"),
    ("history", "Civilizations & History"),
    ("crafts", "Traditional Arts & Crafts"),
    ("festivals", "Festivals & Cultural Practices"),
    ("performing-arts", "Music, Dance & Performing Arts"),
    ("textiles", "Textiles & Weaving"),
    ("folklore", "Folklore & Oral Traditions"),
    ("techniques", "Traditional Knowledge & Techniques"),
    ("architecture", "Architecture & Monuments"),
    ("languages", "Languages & Literature"),
]


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def db():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_database():
    connection = db()
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'contributor',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS contributions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            topic_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            guide_json TEXT NOT NULL,
            transcript TEXT NOT NULL,
            attribution TEXT NOT NULL DEFAULT '',
            consent INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'draft',
            admin_feedback TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            submitted_at TEXT,
            published_at TEXT,
            FOREIGN KEY(owner_id) REFERENCES users(id),
            FOREIGN KEY(topic_id) REFERENCES topics(id)
        );
        CREATE TABLE IF NOT EXISTS review_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contribution_id INTEGER NOT NULL,
            reviewer_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            feedback TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );
    """)
    for slug, name in TOPICS:
        connection.execute("INSERT OR IGNORE INTO topics(slug, name) VALUES (?, ?)", (slug, name))
    connection.commit()
    connection.close()


init_database()


def current_user():
    # Flask signs this session cookie, so visitors cannot pretend to be another user.
    user_id = session.get("user_id")
    if not isinstance(user_id, int):
        return None
    connection = db()
    user = connection.execute("SELECT id, email, role FROM users WHERE id = ?", (user_id,)).fetchone()
    connection.close()
    return dict(user) if user else None


def login_required(route):
    @wraps(route)
    def wrapped(*args, **kwargs):
        if not current_user():
            return jsonify({"error": "Please sign in first"}), 401
        return route(*args, **kwargs)
    return wrapped


def admin_required(route):
    @wraps(route)
    def wrapped(*args, **kwargs):
        user = current_user()
        if not user or user["role"] != "admin":
            return jsonify({"error": "Administrator access required"}), 403
        return route(*args, **kwargs)
    return wrapped

# This client connects the transcription route to Google's Gemini service.
client = genai.Client(
    api_key=os.environ["GEMINI_API_KEY"]
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


# These simple page routes make every part of the contribution journey visible.
@app.get("/account")
def account_page():
    return send_from_directory("static", "account.html")


@app.get("/contributions")
def contributions_page():
    return send_from_directory("static", "contributions.html")


@app.get("/admin")
def admin_page():
    return send_from_directory("static", "admin.html")


@app.get("/topics")
@app.get("/topics/<slug>")
@app.get("/explore")
@app.get("/explore/<slug>")
def topics_page(slug=None):
    return send_from_directory("static", "topics.html")


@app.get("/guides/<int:contribution_id>")
def guide_page(contribution_id):
    return send_from_directory("static", "guide.html")


# Tell browsers that this website is allowed to request its own microphone.
# HTTPS (or localhost during development) is still required by the browser.
@app.after_request
def allow_same_site_microphone(response):
    response.headers["Permissions-Policy"] = "microphone=(self)"
    return response


@app.before_request
def protect_state_changes():
    """Reject browser write requests that came from a different website."""
    if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
        return None
    origin = request.headers.get("Origin")
    if not origin:
        return None
    source = urlsplit(origin)
    if source.netloc != request.host:
        return jsonify({"error": "This request did not come from Smriti."}), 403
    return None


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


@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if "@" not in email or len(password) < 8:
        return jsonify({"error": "Use a valid email and a password of at least 8 characters."}), 400
    connection = db()
    try:
        cursor = connection.execute(
            "INSERT INTO users(email, password_hash, created_at) VALUES (?, ?, ?)",
            (email, generate_password_hash(password), utc_now()),
        )
        connection.commit()
    except sqlite3.IntegrityError:
        connection.close()
        return jsonify({"error": "That email is already registered."}), 409
    connection.close()
    session.clear()
    session["user_id"] = cursor.lastrowid
    return jsonify({"success": True, "user": {"id": cursor.lastrowid, "email": email, "role": "contributor"}}), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()

    # This private-project shortcut works only on the same computer as Flask.
    # Typing "admin" never creates a passwordless account for network visitors.
    if email == "admin" and request.remote_addr in ("127.0.0.1", "::1"):
        connection = db()
        user = connection.execute("SELECT * FROM users WHERE email = ?", ("local-admin@smriti.local",)).fetchone()
        if not user:
            cursor = connection.execute(
                "INSERT INTO users(email,password_hash,role,created_at) VALUES(?,?,?,?)",
                ("local-admin@smriti.local", generate_password_hash(secrets.token_urlsafe(32)), "admin", utc_now()),
            )
            connection.commit()
            user = connection.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
        connection.close()
        session.clear()
        session["user_id"] = user["id"]
        return jsonify({"success": True, "user": {"id": user["id"], "email": "admin", "role": "admin"}})

    connection = db()
    user = connection.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    connection.close()
    if not user or not check_password_hash(user["password_hash"], str(data.get("password", ""))):
        return jsonify({"error": "Email or password is incorrect."}), 401
    session.clear()
    session["user_id"] = user["id"]
    return jsonify({"success": True, "user": {"id": user["id"], "email": user["email"], "role": user["role"]}})


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify({"success": True})


@app.get("/api/auth/me")
def auth_me():
    """Tell a page whether someone is signed in without exposing private data."""
    return jsonify({"user": current_user()})


@app.get("/api/topics")
def list_topics():
    connection = db()
    topics = [dict(row) for row in connection.execute("SELECT id, slug, name, description FROM topics ORDER BY id")]
    connection.close()
    return jsonify({"topics": topics})


def guide_prompt(transcript):
    return f"""Convert this heritage transcript into accurate structured JSON. Do not invent facts. Preserve Indian-language words. Choose guide_type as procedural, historical, festival, oral_tradition, or general. For historical or oral content, do not invent recipe-like steps. Return only JSON with keys: title, introduction, suggested_topic_slug, region, guide_type, materials (array of objects with name and quantity), tools (array), steps (array of objects with number,title,description,tip,warning), cultural_significance, regional_terms (array), review_questions (array). Transcript:\n\n{transcript}"""


@app.post("/api/generate-guide")
def generate_guide():
    data = request.get_json(silent=True) or {}
    transcript = str(data.get("transcript", "")).strip()
    if not transcript:
        return jsonify({"error": "Add a transcript before generating a guide."}), 400
    if len(transcript) > 30000:
        return jsonify({"error": "This transcript is too long. Please shorten it to 30,000 characters."}), 413
    try:
        result = client.models.generate_content(
            model=os.environ.get("SMRITI_GUIDE_MODEL", "gemini-2.5-flash"),
            contents=guide_prompt(transcript),
            config={"response_mime_type": "application/json"},
        )
        guide = json.loads(result.text)
        if not isinstance(guide, dict) or not guide.get("title"):
            raise ValueError("Guide JSON is missing a title")
        guide.setdefault("materials", [])
        guide.setdefault("tools", [])
        guide.setdefault("steps", [])
        guide.setdefault("review_questions", [])
        return jsonify({"guide": guide})
    except json.JSONDecodeError:
        return jsonify({"error": "The AI returned an unreadable guide. Please try again."}), 502
    except Exception:
        app.logger.exception("Guide generation failed")
        return jsonify({"error": "Guide generation failed. Check the server log or try again."}), 502


def contribution_row(row):
    item = dict(row)
    item["guide"] = json.loads(item.pop("guide_json"))
    if "consent" in item:
        item["consent"] = bool(item["consent"])
    return item


@app.post("/api/contributions")
@login_required
def save_contribution():
    data = request.get_json(silent=True) or {}
    user = current_user()
    topic_slug = str(data.get("topic_slug", "")).strip()
    guide = data.get("guide")
    title = str(data.get("title") or (guide or {}).get("title", "")).strip()
    transcript = str(data.get("transcript", "")).strip()
    if not title or not isinstance(guide, dict) or not transcript or not topic_slug:
        return jsonify({"error": "Title, topic, transcript, and guide are required."}), 400
    connection = db()
    topic = connection.execute("SELECT id FROM topics WHERE slug = ?", (topic_slug,)).fetchone()
    if not topic:
        connection.close()
        return jsonify({"error": "Choose a valid heritage topic."}), 400
    now = utc_now()
    cursor = connection.execute("""INSERT INTO contributions(owner_id, topic_id, title, guide_json, transcript, attribution, consent, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)""", (user["id"], topic["id"], title, json.dumps(guide, ensure_ascii=False), transcript, str(data.get("attribution", "")), int(bool(data.get("consent"))), now, now))
    connection.commit()
    connection.close()
    return jsonify({"id": cursor.lastrowid, "status": "draft"}), 201


@app.get("/api/contributions/mine")
@login_required
def my_contributions():
    user = current_user()
    connection = db()
    rows = connection.execute("""SELECT c.*, t.slug AS topic_slug, t.name AS topic_name FROM contributions c JOIN topics t ON t.id=c.topic_id WHERE c.owner_id=? ORDER BY c.updated_at DESC""", (user["id"],)).fetchall()
    connection.close()
    return jsonify({"contributions": [contribution_row(row) for row in rows]})


@app.get("/api/contributions/<int:contribution_id>")
@login_required
def get_owned_contribution(contribution_id):
    """Return one editable contribution only to the person who created it."""
    user = current_user()
    connection = db()
    row = connection.execute("""SELECT c.*,t.slug AS topic_slug,t.name AS topic_name FROM contributions c JOIN topics t ON t.id=c.topic_id WHERE c.id=? AND c.owner_id=?""", (contribution_id, user["id"])).fetchone()
    connection.close()
    if not row:
        return jsonify({"error": "Contribution not found."}), 404
    return jsonify({"contribution": contribution_row(row)})


@app.put("/api/contributions/<int:contribution_id>")
@login_required
def update_contribution(contribution_id):
    """Let an owner revise a draft or a guide returned by an administrator."""
    data = request.get_json(silent=True) or {}
    user = current_user()
    guide = data.get("guide")
    title = str(data.get("title") or (guide or {}).get("title", "")).strip()
    transcript = str(data.get("transcript", "")).strip()
    topic_slug = str(data.get("topic_slug", "")).strip()
    if not title or not transcript or not isinstance(guide, dict):
        return jsonify({"error": "Title, transcript, and guide are required."}), 400
    connection = db()
    topic = connection.execute("SELECT id FROM topics WHERE slug=?", (topic_slug,)).fetchone()
    owned = connection.execute("SELECT status FROM contributions WHERE id=? AND owner_id=?", (contribution_id, user["id"])).fetchone()
    if not owned:
        connection.close()
        return jsonify({"error": "Contribution not found."}), 404
    if owned["status"] not in ("draft", "needs_changes"):
        connection.close()
        return jsonify({"error": "A submitted or published guide can no longer be edited."}), 409
    if not topic:
        connection.close()
        return jsonify({"error": "Choose a valid heritage topic."}), 400
    connection.execute("""UPDATE contributions SET topic_id=?,title=?,guide_json=?,transcript=?,attribution=?,consent=?,updated_at=? WHERE id=?""",
        (topic["id"], title, json.dumps(guide, ensure_ascii=False), transcript, str(data.get("attribution", "")).strip(), int(bool(data.get("consent"))), utc_now(), contribution_id))
    connection.commit()
    connection.close()
    return jsonify({"id": contribution_id, "status": owned["status"]})


@app.post("/api/contributions/<int:contribution_id>/submit")
@login_required
def submit_contribution(contribution_id):
    user = current_user()
    connection = db()
    row = connection.execute("SELECT * FROM contributions WHERE id=? AND owner_id=?", (contribution_id, user["id"])).fetchone()
    if not row:
        connection.close(); return jsonify({"error": "Contribution not found."}), 404
    if not row["consent"]:
        connection.close(); return jsonify({"error": "Publication consent is required before submission."}), 400
    if row["status"] not in ("draft", "needs_changes"):
        connection.close(); return jsonify({"error": "Only drafts or requested changes can be submitted."}), 409
    connection.execute("UPDATE contributions SET status='pending_review', consent=1, submitted_at=?, updated_at=? WHERE id=?", (utc_now(), utc_now(), contribution_id))
    connection.commit(); connection.close()
    return jsonify({"success": True, "status": "pending_review"})


@app.get("/api/topics/<slug>/contributions")
def topic_contributions(slug):
    connection = db()
    rows = connection.execute("""SELECT c.id,c.title,c.guide_json,c.attribution,c.published_at,t.slug AS topic_slug,t.name AS topic_name FROM contributions c JOIN topics t ON t.id=c.topic_id WHERE t.slug=? AND c.status='published' ORDER BY c.published_at DESC""", (slug,)).fetchall()
    connection.close()
    return jsonify({"contributions": [contribution_row(row) for row in rows]})


@app.get("/api/public/contributions/<int:contribution_id>")
def public_contribution(contribution_id):
    connection = db(); row = connection.execute("""SELECT c.*,t.slug AS topic_slug,t.name AS topic_name FROM contributions c JOIN topics t ON t.id=c.topic_id WHERE c.id=? AND c.status='published'""", (contribution_id,)).fetchone(); connection.close()
    return (jsonify({"contribution": contribution_row(row)}), 200) if row else (jsonify({"error": "Contribution not found."}), 404)


@app.get("/api/admin/contributions")
@admin_required
def admin_contributions():
    connection = db(); rows = connection.execute("""SELECT c.*,t.slug AS topic_slug,t.name AS topic_name,u.email FROM contributions c JOIN topics t ON t.id=c.topic_id JOIN users u ON u.id=c.owner_id WHERE c.status='pending_review' ORDER BY c.submitted_at""").fetchall(); connection.close()
    return jsonify({"contributions": [contribution_row(row) for row in rows]})


@app.post("/api/admin/contributions/<int:contribution_id>/approve")
@admin_required
def approve_contribution(contribution_id):
    user = current_user(); connection = db(); now = utc_now(); cursor = connection.execute("UPDATE contributions SET status='published', admin_feedback='', published_at=?, updated_at=? WHERE id=? AND status='pending_review'", (now, now, contribution_id))
    if cursor.rowcount:
        connection.execute("INSERT INTO review_history(contribution_id,reviewer_id,action,feedback,created_at) VALUES(?,?,?,?,?)", (contribution_id, user["id"], "approved", "", now))
    connection.commit(); connection.close()
    return jsonify({"success": cursor.rowcount == 1, "status": "published" if cursor.rowcount else "not_found"})


@app.post("/api/admin/contributions/<int:contribution_id>/request-changes")
@admin_required
def request_changes(contribution_id):
    data = request.get_json(silent=True) or {}; feedback = str(data.get("feedback", "")).strip()
    if not feedback: return jsonify({"error": "Feedback is required."}), 400
    user = current_user(); connection = db(); now = utc_now(); cursor = connection.execute("UPDATE contributions SET status='needs_changes', admin_feedback=?, updated_at=? WHERE id=? AND status='pending_review'", (feedback, now, contribution_id))
    if cursor.rowcount:
        connection.execute("INSERT INTO review_history(contribution_id,reviewer_id,action,feedback,created_at) VALUES(?,?,?,?,?)", (contribution_id, user["id"], "changes_requested", feedback, now))
    connection.commit(); connection.close()
    if not cursor.rowcount:
        return jsonify({"error": "Pending contribution not found."}), 404
    return jsonify({"success": True, "status": "needs_changes"})


# Start the development server only when this file is run directly.
if __name__ == "__main__":
    # Create an administrator without storing a password in source code.
    if len(os.sys.argv) == 4 and os.sys.argv[1] == "create-admin":
        email, password = os.sys.argv[2], os.sys.argv[3]
        connection = db()
        connection.execute("INSERT INTO users(email,password_hash,role,created_at) VALUES(?,?,?,?)", (email, generate_password_hash(password), "admin", utc_now()))
        connection.commit(); connection.close()
        print(f"Administrator created for {email}")
    else:
        app.run(debug=True)
