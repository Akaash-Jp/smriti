"""Small end-to-end checks for Smriti's contribution approval journey."""

import json
import os
import tempfile
import unittest

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


if __name__ == "__main__":
    unittest.main()
