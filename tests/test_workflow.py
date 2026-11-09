"""Small end-to-end checks for Smriti's contribution approval journey."""

import json
import io
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock

import app as smriti
from werkzeug.security import generate_password_hash


class ContributionWorkflowTest(unittest.TestCase):
    """Use a temporary database so tests never change the real archive."""

    def setUp(self):
        self.temp_folder = tempfile.TemporaryDirectory()
        self.original_database = smriti.DATABASE_PATH
        smriti.DATABASE_PATH = os.path.join(self.temp_folder.name, "test.db")
        smriti.init_database()
        smriti.app.config.update(TESTING=True)

    def tearDown(self):
        smriti.DATABASE_PATH = self.original_database
        self.temp_folder.cleanup()

    def guide_payload(self):
        """Return a complete but short guide used by several test steps."""
        return {
            "title": "A Family Weaving Tradition",
            "guide": {
                "title": "A Family Weaving Tradition",
                "introduction": "An introduction to a shared weaving practice.",
                "materials": [{"name": "Silk thread", "quantity": "two bundles"}],
                "tools": ["Handloom"],
                "steps": [{"number": 1, "title": "Prepare", "description": "Prepare the threads.", "tip": "Work slowly", "warning": ""}],
                "cultural_significance": "The practice carries family knowledge.",
            },
            "transcript": "This tradition was taught to me by my grandmother.",
            "topic_slug": "textiles",
            "attribution": "Community contributor",
            "consent": True,
        }

    def test_register_submit_approve_and_publish(self):
        """Prove that a guide travels through every required status."""
        contributor = smriti.app.test_client()
        registered = contributor.post("/api/auth/register", json={"email": "maker@example.com", "password": "strong-pass"})
        self.assertEqual(registered.status_code, 201)

        saved = contributor.post("/api/contributions", json=self.guide_payload())
        self.assertEqual(saved.status_code, 201)
        contribution_id = saved.get_json()["id"]

        submitted = contributor.post(f"/api/contributions/{contribution_id}/submit", json={})
        self.assertEqual(submitted.get_json()["status"], "pending_review")

        connection = smriti.db()
        cursor = connection.execute("INSERT INTO users(email,password_hash,role,created_at) VALUES(?,?,?,?)", ("admin@example.com", generate_password_hash("admin-pass"), "admin", smriti.utc_now()))
        connection.commit()
        admin_id = cursor.lastrowid
        connection.close()

        administrator = smriti.app.test_client()
        with administrator.session_transaction() as admin_session:
            admin_session["user_id"] = admin_id
        queue = administrator.get("/api/admin/contributions")
        self.assertEqual(len(queue.get_json()["contributions"]), 1)

        approved = administrator.post(f"/api/admin/contributions/{contribution_id}/approve")
        self.assertEqual(approved.get_json()["status"], "published")

        public = contributor.get(f"/api/public/contributions/{contribution_id}")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.get_json()["contribution"]["topic_slug"], "textiles")

    def test_saved_draft_appears_in_my_contributions(self):
        """A successful draft save must be visible to the same signed-in contributor."""
        contributor = smriti.app.test_client()
        contributor.post("/api/auth/register", json={"email": "draft@example.com", "password": "strong-pass"})
        saved = contributor.post("/api/contributions", json=self.guide_payload())
        mine = contributor.get("/api/contributions/mine")
        self.assertEqual(saved.status_code, 201)
        self.assertEqual(len(mine.get_json()["contributions"]), 1)
        self.assertEqual(mine.get_json()["contributions"][0]["status"], "draft")

    def test_unapproved_guide_is_not_public(self):
        """A saved draft must stay private until an administrator approves it."""
        contributor = smriti.app.test_client()
        contributor.post("/api/auth/register", json={"email": "private@example.com", "password": "strong-pass"})
        saved = contributor.post("/api/contributions", json=self.guide_payload()).get_json()
        self.assertEqual(contributor.get(f"/api/public/contributions/{saved['id']}").status_code, 404)

    def test_local_admin_shortcut(self):
        """The private admin shortcut works locally and never needs registration."""
        local_browser = smriti.app.test_client()
        login = local_browser.post("/api/auth/login", json={"email": "admin", "password": ""})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.get_json()["user"]["role"], "admin")
        self.assertEqual(local_browser.get("/api/admin/contributions").status_code, 200)

    def test_admin_shortcut_is_localhost_only(self):
        """A network visitor cannot use the passwordless shortcut."""
        network_browser = smriti.app.test_client()
        login = network_browser.post(
            "/api/auth/login",
            json={"email": "admin", "password": ""},
            environ_base={"REMOTE_ADDR": "192.168.1.50"},
        )
        self.assertEqual(login.status_code, 401)

    def test_map_page_is_available(self):
        """The imported map is served without replacing the existing homepage."""
        browser = smriti.app.test_client()
        map_response = browser.get("/map")
        home_response = browser.get("/")
        try:
            self.assertEqual(map_response.status_code, 200)
            self.assertEqual(home_response.status_code, 200)
        finally:
            map_response.close()
            home_response.close()

    def test_groq_transcription_response_reaches_the_page(self):
        """A Groq transcript is returned in the format expected by JavaScript."""
        original_client = smriti.groq_client
        fake_create = Mock(return_value=SimpleNamespace(text="A remembered weaving story."))
        smriti.groq_client = SimpleNamespace(
            audio=SimpleNamespace(translations=SimpleNamespace(create=fake_create))
        )
        try:
            browser = smriti.app.test_client()
            response = browser.post(
                "/api/process",
                data={"audio": (io.BytesIO(b"fake audio"), "story.webm")},
                content_type="multipart/form-data",
            )
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["transcript"], "A remembered weaving story.")
            self.assertEqual(fake_create.call_args.kwargs["model"], "whisper-large-v3")
            self.assertEqual(fake_create.call_args.kwargs["file"][0], "story.webm")
        finally:
            smriti.groq_client = original_client

    def test_empty_groq_transcript_is_not_treated_as_success(self):
        """A silent recording receives useful feedback instead of a blank editor."""
        original_client = smriti.groq_client
        smriti.groq_client = SimpleNamespace(
            audio=SimpleNamespace(translations=SimpleNamespace(create=Mock(return_value=SimpleNamespace(text="   "))))
        )
        try:
            response = smriti.app.test_client().post(
                "/api/process",
                data={"audio": (io.BytesIO(b"fake audio"), "silence.wav")},
                content_type="multipart/form-data",
            )
            self.assertEqual(response.status_code, 422)
            self.assertIn("No speech", response.get_json()["error"])
        finally:
            smriti.groq_client = original_client

    def test_groq_guide_response_reaches_the_editor(self):
        """A structured Groq guide is returned with its selected collection."""
        guide = self.guide_payload()["guide"] | {
            "suggested_topic_slug": "textiles",
            "region": "Tamil Nadu",
            "guide_type": "procedural",
            "regional_terms": [],
            "review_questions": [],
        }
        original_client = smriti.groq_client
        fake_create = Mock(return_value=SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(guide)))]
        ))
        smriti.groq_client = SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))
        )
        try:
            browser = smriti.app.test_client()
            response = browser.post("/api/generate-guide", json={"transcript": "We prepare silk threads before weaving."})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["guide"]["suggested_topic_slug"], "textiles")
            self.assertEqual(fake_create.call_args.kwargs["response_format"]["type"], "json_schema")
            self.assertEqual(fake_create.call_args.kwargs["reasoning_effort"], "low")
        finally:
            smriti.groq_client = original_client

    def test_incomplete_ai_guide_is_rejected(self):
        """Broken AI output must not reach the tutorial editor as if it were valid."""
        original_client = smriti.groq_client
        fake_create = Mock(return_value=SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({"title": "Only a title"})))]
        ))
        smriti.groq_client = SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))
        )
        try:
            response = smriti.app.test_client().post("/api/generate-guide", json={"transcript": "A short source."})
            self.assertEqual(response.status_code, 502)
            self.assertIn("Guide generation failed", response.get_json()["error"])
        finally:
            smriti.groq_client = original_client


if __name__ == "__main__":
    unittest.main()
