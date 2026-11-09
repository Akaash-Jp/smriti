// This helper safely turns visitor text into plain text instead of executable HTML.
function escapeHtml(value = "") {
    const box = document.createElement("div");
    box.textContent = String(value);
    return box.innerHTML;
}

// Every API call reads the server's friendly error message in the same way.
async function api(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
}

// Dates are displayed in the visitor's own familiar format.
function friendlyDate(value) {
    return value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Not yet";
}

// The shared header changes its last link according to sign-in state.
async function updateHeader() {
    const spot = document.querySelector("[data-account-link]");
    if (!spot) return null;
    const { user } = await api("/api/auth/me");
    spot.innerHTML = user
        ? `<a href="/contributions">My contributions</a>${user.role === "admin" ? '<a href="/admin">Review</a>' : ''}<button class="link-button" data-logout>Sign out</button>`
        : '<a href="/account">Sign in</a>';
    spot.querySelector("[data-logout]")?.addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }); location.href = "/"; });
    return user;
}

// Account page: one small form switches between registration and login.
async function startAccountPage() {
    const user = await updateHeader();
    if (user) { location.href = user.role === "admin" ? "/admin" : "/contributions"; return; }
    const form = document.querySelector("#accountForm");
    const title = document.querySelector("#accountTitle");
    const switchButton = document.querySelector("#switchMode");
    const status = document.querySelector("#accountStatus");
    let mode = "login";
    switchButton.addEventListener("click", () => { mode = mode === "login" ? "register" : "login"; title.textContent = mode === "login" ? "Welcome back" : "Create your contributor account"; switchButton.textContent = mode === "login" ? "Need an account? Register" : "Already registered? Sign in"; });
    form.addEventListener("submit", async (event) => {
        event.preventDefault(); status.textContent = mode === "login" ? "Signing in…" : "Creating account…";
        try { const result = await api(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email.value, password: form.password.value }) }); const next = new URLSearchParams(location.search).get("next"); location.href = result.user.role === "admin" ? "/admin" : (next && next.startsWith("/") && !next.startsWith("//") ? next : "/contributions"); }
        catch (error) { status.textContent = error.message; }
    });
}

// Contributions page: owners can see the state and resubmit returned work.
async function startContributionsPage() {
    const user = await updateHeader();
    if (!user) { location.href = "/account?next=/contributions"; return; }
    const list = document.querySelector("#contributionList");
    try {
        const { contributions } = await api("/api/contributions/mine");
        if (!contributions.length) { list.innerHTML = '<div class="empty-state">You have not saved a contribution yet.<br><br><a class="primary-action" href="/#contribute">Create your first guide</a></div>'; return; }
        list.innerHTML = contributions.map(item => `<article class="portal-card"><span class="status-badge">${escapeHtml(item.status.replaceAll("_", " "))}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.topic_name)} · Updated ${friendlyDate(item.updated_at)}</p>${item.admin_feedback ? `<p class="feedback"><strong>Reviewer note:</strong> ${escapeHtml(item.admin_feedback)}</p>` : ""}<div class="card-actions">${item.status === "published" ? `<a class="secondary-action" href="/guides/${item.id}">View published guide</a><a class="secondary-action" href="/explore/${item.topic_slug}">Explore collection</a>` : ""}${["draft","needs_changes"].includes(item.status) ? `<a class="primary-action" href="/?edit=${item.id}#contribute">Edit guide</a>` : ""}</div></article>`).join("");
    } catch (error) { list.innerHTML = `<p class="feedback">${escapeHtml(error.message)}</p>`; }
}

// Explore groups connect the six landing cards to the ten detailed database topics.
const exploreGroups = [
    { number: "01", name: "Traditional Medicine", description: "Healing practices and knowledge passed through communities.", topics: ["techniques"] },
    { number: "02", name: "Monuments", description: "Temples, forts, palaces, and the stories held by places.", topics: ["architecture"] },
    { number: "03", name: "Ancient Texts", description: "Languages, literature, manuscripts, and spoken memory.", topics: ["languages", "folklore"] },
    { number: "04", name: "Culture", description: "Festivals, performance, craft, ritual, and celebration.", topics: ["festivals", "performing-arts", "crafts"] },
    { number: "05", name: "Lifestyle", description: "Food, clothing, weaving, occupations, and daily practice.", topics: ["food", "textiles"] },
    { number: "06", name: "Civilisations", description: "People, dynasties, trade routes, and shared histories.", topics: ["history"] },
];

// Explore page: Curated is an honest empty state; Community reads approved database entries.
async function startTopicsPage() {
    await updateHeader();
    const { topics } = await api("/api/topics");
    const slug = location.pathname.split("/").filter(Boolean)[1] || topics[0].slug;
    const topic = topics.find(item => item.slug === slug) || topics[0];
    const bySlug = Object.fromEntries(topics.map(item => [item.slug, item]));
    document.querySelector("#exploreGroups").innerHTML = exploreGroups.map(group => `<article class="collection-card"><span>${group.number}</span><h2>${escapeHtml(group.name)}</h2><p>${escapeHtml(group.description)}</p><div class="collection-links">${group.topics.map(topicSlug => `<a href="/explore/${topicSlug}">${escapeHtml(bySlug[topicSlug].name)} →</a>`).join("")}</div></article>`).join("");
    document.querySelector("#topicTitle").textContent = topic.name;
    document.querySelector("#topicPicker").innerHTML = topics.map(item => `<a class="topic-chip ${item.slug === topic.slug ? "active" : ""}" href="/explore/${item.slug}">${escapeHtml(item.name)}</a>`).join("");
    const content = document.querySelector("#topicContent");
    const showTab = async (tab) => {
        document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
        if (tab === "curated") { content.innerHTML = '<div class="empty-state"><strong>Curated guides are being prepared.</strong><br>Approved community knowledge is available in the Community tab.</div>'; return; }
        const { contributions } = await api(`/api/topics/${topic.slug}/contributions`);
        content.innerHTML = contributions.length ? `<div class="card-grid">${contributions.map(item => `<article class="portal-card"><span class="status-badge">Community</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.guide.introduction || "A community-contributed heritage guide.")}</p><a class="secondary-action" href="/guides/${item.id}">Read guide</a></article>`).join("")}</div>` : '<div class="empty-state">No community guides have been approved for this topic yet.</div>';
    };
    document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => showTab(button.dataset.tab)));
    showTab("community");
}

// Admin page: only the server decides who may read or change review data.
async function startAdminPage() {
    const user = await updateHeader();
    const list = document.querySelector("#reviewList");
    if (!user || user.role !== "admin") { list.innerHTML = '<div class="empty-state">Administrator access is required.<br><br><a class="primary-action" href="/account">Sign in</a></div>'; return; }
    async function loadQueue() {
        const { contributions } = await api("/api/admin/contributions");
        if (!contributions.length) { list.innerHTML = '<div class="empty-state">The review queue is clear.</div>'; return; }
        list.innerHTML = contributions.map(item => `<article class="portal-card" data-review="${item.id}"><span class="status-badge">Pending review</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.topic_name)} · submitted by ${escapeHtml(item.email)}</p><p>${escapeHtml(item.guide.introduction || "")}</p><details><summary>Read transcript and guide steps</summary><p>${escapeHtml(item.transcript)}</p>${(item.guide.steps || []).map(step => `<div class="guide-step"><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.description)}</p></div>`).join("")}</details><label class="field">Feedback for contributor<textarea rows="3" data-feedback></textarea></label><div class="card-actions"><button class="primary-action" data-approve>Approve and publish</button><button class="secondary-action danger-action" data-changes>Request changes</button></div><p class="status-message" data-status></p></article>`).join("");
        list.querySelectorAll("[data-review]").forEach(card => {
            const id = card.dataset.review; const status = card.querySelector("[data-status]");
            card.querySelector("[data-approve]").addEventListener("click", async () => { try { await api(`/api/admin/contributions/${id}/approve`, { method: "POST" }); await loadQueue(); } catch (error) { status.textContent = error.message; } });
            card.querySelector("[data-changes]").addEventListener("click", async () => { try { await api(`/api/admin/contributions/${id}/request-changes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedback: card.querySelector("[data-feedback]").value }) }); await loadQueue(); } catch (error) { status.textContent = error.message; } });
        });
    }
    try { await loadQueue(); } catch (error) { list.innerHTML = `<p class="feedback">${escapeHtml(error.message)}</p>`; }
}

// Public guide page: only already-approved work can be returned by this endpoint.
async function startGuidePage() {
    await updateHeader();
    const id = location.pathname.split("/").filter(Boolean)[1];
    const area = document.querySelector("#publicGuide");
    try {
        const { contribution: item } = await api(`/api/public/contributions/${id}`); const guide = item.guide;
        const icons = ["◉", "◇", "⌁", "☼", "♨", "◌", "✦"];
        const steps = (guide.steps || []).map((step, index) => `<article class="tutorial-step"><div class="tutorial-step-heading"><span class="tutorial-step-icon">${icons[index % icons.length]}</span><div><span class="tutorial-step-number">STEP ${String(index + 1).padStart(2, "0")}</span><h4>${escapeHtml(step.title || "Untitled step")}</h4></div></div><p>${escapeHtml(step.description || "")}</p>${step.tip ? `<p class="tutorial-tip">Tip: ${escapeHtml(step.tip)}</p>` : ""}${step.warning ? `<p class="tutorial-warning">Take care: ${escapeHtml(step.warning)}</p>` : ""}</article>${index < guide.steps.length - 1 ? '<span class="tutorial-arrow">↓</span>' : ""}`).join("");
        const materials = (guide.materials || []).map(material => escapeHtml(`${material.name}${material.quantity ? ` (${material.quantity})` : ""}`)).join(" · ") || "No materials listed";
        area.innerHTML = `<p class="portal-kicker">${escapeHtml(item.topic_name)} · Community tutorial</p><div class="tutorial-shell"><header class="tutorial-header"><span class="tutorial-main-icon">✦</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(guide.introduction || "A step-by-step heritage guide")}</p></header><section class="tutorial-needs"><h4>Materials needed</h4><p>${materials}</p><p class="tutorial-tools">${(guide.tools || []).length ? `Also required: ${(guide.tools || []).map(escapeHtml).join(" · ")}` : "No additional tools listed"}</p></section><section class="tutorial-sequence">${steps || "<p>This knowledge is shared as a story rather than a physical process.</p>"}</section><footer class="tutorial-finish"><span>✓</span><strong>Tutorial complete</strong><p>${escapeHtml(guide.cultural_significance || "Review this community knowledge with care.")}</p></footer></div>${item.attribution ? `<p>Shared with permission by <strong>${escapeHtml(item.attribution)}</strong>.</p>` : ""}`;
    } catch (error) { area.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; }
}

// Only the function matching this page is started.
const starters = { account: startAccountPage, contributions: startContributionsPage, topics: startTopicsPage, admin: startAdminPage, guide: startGuidePage };
starters[document.body.dataset.page]?.();
