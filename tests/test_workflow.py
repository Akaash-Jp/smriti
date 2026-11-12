"""Small end-to-end checks for Heritage-101's contribution approval journey."""

import json
import io
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

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

    def test_health_check_reports_service_is_ready(self):
        """Cloud Run and visitors can verify that the deployed app is alive."""
        with smriti.app.test_client() as client:
            response = client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json(),
            {"status": "ok", "service": "Heritage-101"},
        )

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

    def test_owner_can_delete_contribution_but_another_user_cannot(self):
        """Deletion removes an owner's guide without exposing it to another account."""
        owner = smriti.app.test_client()
        owner.post("/api/auth/register", json={"email": "owner@example.com", "password": "strong-pass"})
        contribution_id = owner.post("/api/contributions", json=self.guide_payload()).get_json()["id"]

        stranger = smriti.app.test_client()
        stranger.post("/api/auth/register", json={"email": "stranger@example.com", "password": "strong-pass"})
        denied = stranger.delete(f"/api/contributions/{contribution_id}")
        self.assertEqual(denied.status_code, 404)

        deleted = owner.delete(f"/api/contributions/{contribution_id}")
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(owner.get("/api/contributions/mine").get_json()["contributions"], [])
        self.assertEqual(owner.get(f"/api/contributions/{contribution_id}").status_code, 404)

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

    def test_map_feature_is_available(self):
        """The supplied interactive atlas is available from the Map route."""
        browser = smriti.app.test_client()
        map_response = browser.get("/map")
        map_file = browser.get("/static/map.html")
        try:
            self.assertEqual(map_response.status_code, 200)
            self.assertEqual(map_file.status_code, 200)
            self.assertIn(b"Heritage-101", map_response.data)
            self.assertIn(b"indiaMapSvg", map_response.data)
        finally:
            map_response.close()
            map_file.close()

    def test_every_page_uses_the_role_aware_shared_header(self):
        """All visible pages share one header and keep Review admin-only."""
        browser = smriti.app.test_client()
        for path in ("/", "/explore", "/map", "/account", "/contributions", "/admin", "/guides/1"):
            page = browser.get(path)
            try:
                self.assertEqual(page.status_code, 200, path)
                self.assertIn(b'class="site-header', page.data, path)
                self.assertIn(b"data-account-menu", page.data, path)
                self.assertIn(b"/static/header.js", page.data, path)
            finally:
                page.close()

        header_script = browser.get("/static/header.js")
        try:
            self.assertIn(b'user.role === "admin"', header_script.data)
            self.assertIn(b"My contributions", header_script.data)
            self.assertIn(b"Review contributions", header_script.data)
        finally:
            header_script.close()

    def test_unsigned_draft_handoff_survives_login(self):
        """The browser keeps a pending contribution and honours its return URL."""
        browser = smriti.app.test_client()
        homepage_script = browser.get("/static/script.js")
        account_script = browser.get("/static/portal.js")
        try:
            self.assertIn(b"rememberPendingContribution({ payload, submit })", homepage_script.data)
            self.assertIn(b"readPendingContribution()", homepage_script.data)
            self.assertIn(b"localStorage.setItem", homepage_script.data)
            self.assertIn(b"location.href = safeNext ||", account_script.data)
        finally:
            homepage_script.close()
            account_script.close()

    def test_explore_collections_are_available_without_an_api_key(self):
        """Explore collection names load locally before Wikipedia is contacted."""
        response = smriti.app.test_client().get("/api/explore/collections")
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.get_json()["collections"]), 6)
        self.assertIn("Wikipedia", response.get_json()["source"])

    @patch("app.wikipedia_summary")
    def test_explore_collection_returns_wikipedia_cards(self, fake_summary):
        """The API turns curated article titles into source-linked cards."""
        fake_summary.side_effect = lambda title: {
            "title": title,
            "description": "Heritage topic",
            "extract": "A concise article summary.",
            "image": "https://upload.wikimedia.org/example.jpg",
            "source_url": "https://en.wikipedia.org/wiki/Example",
            "source_name": "Wikipedia",
        }
        response = smriti.app.test_client().get("/api/explore/articles/ancient-india")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["articles"]), 6)
        self.assertEqual(fake_summary.call_count, 6)

    @patch("app.wikipedia_search")
    def test_explore_search_uses_wikimedia_rest_results(self, fake_search):
        """A visitor can search beyond the prepared heritage collections."""
        fake_search.return_value = [{"title": "Dosa", "extract": "A fermented dish."}]
        response = smriti.app.test_client().get("/api/explore/search?q=dosa")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["articles"][0]["title"], "Dosa")

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

    def test_transcript_reviewer_cleans_and_enriches_source(self):
        """The middle AI returns practical text and discloses every addition."""
        review = {
            "practical_transcript": "1. Prepare the clay. 2. Shape the lamp. 3. Let it dry fully.",
            "productive_summary": "A short clay-lamp process with one missing drying step restored.",
            "added_steps": [{"detail": "Let the shaped lamp dry fully.", "why_needed": "Wet clay cannot be fired safely.", "confidence": "high"}],
            "removed_content_summary": ["Greeting and repeated family story"],
            "review_questions": ["Ask the contributor for the correct firing temperature."],
            "risk_level": "medium",
        }
        original_client = smriti.groq_client
        fake_create = Mock(return_value=SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(review)))]
        ))
        smriti.groq_client = SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(create=fake_create))
        )
        try:
            response = smriti.app.test_client().post("/api/review-transcript", json={"transcript": "Hello, we shape clay, you know..."})
            self.assertEqual(response.status_code, 200)
            self.assertIn("Let it dry", response.get_json()["review"]["practical_transcript"])
            self.assertEqual(response.get_json()["review"]["risk_level"], "medium")
            self.assertEqual(fake_create.call_args.kwargs["model"], "openai/gpt-oss-120b")
            self.assertEqual(fake_create.call_args.kwargs["response_format"]["type"], "json_schema")
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

    def test_empty_ai_headings_receive_safe_fallbacks(self):
        """Useful steps survive when the model returns empty schema-valid headings."""
        guide = self.guide_payload()["guide"] | {
            "title": "",
            "introduction": "",
            "suggested_topic_slug": "crafts",
            "region": "",
            "guide_type": "procedural",
            "regional_terms": [],
            "review_questions": [],
        }
        original_client = smriti.groq_client
        smriti.groq_client = SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(create=Mock(return_value=SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(guide)))]
            ))))
        )
        try:
            response = smriti.app.test_client().post("/api/generate-guide", json={"transcript": "Prepare and weave the thread."})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["guide"]["title"], "Practical Heritage Tutorial")
            self.assertTrue(response.get_json()["guide"]["introduction"])
        finally:
            smriti.groq_client = original_client


if __name__ == "__main__":
    unittest.main()
