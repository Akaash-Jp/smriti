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

// The shared header owns the account dropdown and returns the current user here.
async function updateHeader() {
    if (window.HeritageHeader) return window.HeritageHeader.getUser();
    const { user } = await api("/api/auth/me");
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
        try {
            const result = await api(`/api/auth/${mode}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: form.email.value, password: form.password.value }),
            });
            const requestedNext = new URLSearchParams(location.search).get("next");
            const safeNext = requestedNext
                && requestedNext.startsWith("/")
                && !requestedNext.startsWith("//")
                ? requestedNext
                : null;

            // A pending contribution always returns to the editor, even for administrators.
            location.href = safeNext || (result.user.role === "admin" ? "/admin" : "/contributions");
        }
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
        list.innerHTML = contributions.map(item => `<article class="portal-card" data-contribution="${item.id}"><span class="status-badge">${escapeHtml(item.status.replaceAll("_", " "))}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.topic_name)} · Updated ${friendlyDate(item.updated_at)}</p>${item.admin_feedback ? `<p class="feedback"><strong>Reviewer note:</strong> ${escapeHtml(item.admin_feedback)}</p>` : ""}<div class="card-actions">${item.status === "published" ? `<a class="secondary-action" href="/guides/${item.id}">View published guide</a><a class="secondary-action" href="/explore/${item.topic_slug}">Explore collection</a>` : ""}${["draft","needs_changes"].includes(item.status) ? `<a class="primary-action" href="/?edit=${item.id}#contribute">Edit guide</a>` : ""}<button class="secondary-action danger-action" type="button" data-delete-contribution="${item.id}">Delete</button></div><p class="status-message" data-delete-status></p></article>`).join("");

        // Deletion is owner-only on the server and also asks for a clear browser confirmation.
        list.querySelectorAll("[data-delete-contribution]").forEach((button) => {
            button.addEventListener("click", async () => {
                const card = button.closest("[data-contribution]");
                const status = card.querySelector("[data-delete-status]");
                const title = card.querySelector("h2").textContent;
                const confirmed = window.confirm(`Delete “${title}” permanently? Published guides will also disappear from Explore.`);
                if (!confirmed) return;
                button.disabled = true; status.textContent = "Deleting contribution…";
                try {
                    await api(`/api/contributions/${button.dataset.deleteContribution}`, { method: "DELETE" });
                    card.remove();
                    if (!list.querySelector("[data-contribution]")) list.innerHTML = '<div class="empty-state">You have no saved contributions.<br><br><a class="primary-action" href="/#contribute">Create a guide</a></div>';
                } catch (error) { status.textContent = error.message; button.disabled = false; }
            });
        });
    } catch (error) { list.innerHTML = `<p class="feedback">${escapeHtml(error.message)}</p>`; }
}

// Older homepage and contribution links are redirected into the new Wikipedia collections.
const legacyExploreLinks = {
    food: "traditional-food", history: "ancient-india", crafts: "heritage-crafts",
    festivals: "living-cultures", "performing-arts": "living-cultures", textiles: "heritage-crafts",
    folklore: "knowledge-texts", techniques: "knowledge-texts", architecture: "architecture", languages: "knowledge-texts",
};

// Only secure Wikimedia image addresses are allowed into an article card.
function safeWikiImage(value) {
    try { const url = new URL(value); return url.protocol === "https:" && url.hostname.endsWith("wikimedia.org") ? url.href : ""; }
    catch (_error) { return ""; }
}

// Article buttons may link only to English Wikipedia over HTTPS.
function safeWikiSource(value) {
    try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "en.wikipedia.org" ? url.href : "https://en.wikipedia.org/"; }
    catch (_error) { return "https://en.wikipedia.org/"; }
}

// Render REST results with source attribution and a direct route to the full article.
function renderWikiCards(articles, area) {
    if (!articles.length) { area.innerHTML = '<div class="empty-state">No Wikipedia articles matched this search.</div>'; return; }
    area.innerHTML = articles.map((article) => {
        const image = safeWikiImage(article.image);
        const source = safeWikiSource(article.source_url);
        return `<article class="wiki-card">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy">` : '<div class="wiki-image-placeholder" aria-hidden="true">✦</div>'}<div class="wiki-card-body"><span class="wiki-source">Wikipedia</span><h3>${escapeHtml(article.title)}</h3><p class="wiki-description">${escapeHtml(article.description || "Heritage article")}</p><p class="wiki-extract">${escapeHtml(article.extract)}</p><button class="wiki-read-more" type="button" aria-expanded="false">Read more</button><a href="${source}" target="_blank" rel="noreferrer">Read the full Wikipedia article <span aria-hidden="true">↗</span></a></div></article>`;
    }).join("");

    // Summaries stay at three lines until the visitor asks to read the rest.
    area.querySelectorAll(".wiki-read-more").forEach((button) => {
        const extract = button.previousElementSibling;
        if (extract.scrollHeight <= extract.clientHeight + 1) { button.hidden = true; return; }
        button.addEventListener("click", () => {
            const expanded = extract.classList.toggle("expanded");
            button.setAttribute("aria-expanded", String(expanded));
            button.textContent = expanded ? "Read less" : "Read more";
        });
    });
}

// Community contributions remain available underneath the live external knowledge.
async function loadCommunityArchive() {
    const area = document.querySelector("#communityGuides");
    try {
        const { topics } = await api("/api/topics");
        const responses = await Promise.all(topics.map(topic => api(`/api/topics/${topic.slug}/contributions`)));
        const guides = responses.flatMap(result => result.contributions);
        area.innerHTML = guides.length ? guides.map(item => `<article class="portal-card"><span class="status-badge">Community</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.guide.introduction || "A reviewed community heritage guide.")}</p><a class="secondary-action" href="/guides/${item.id}">Open community guide</a></article>`).join("") : '<div class="empty-state">No community guides have been published yet.</div>';
    } catch (error) { area.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; }
}

// Explore combines curated starting points, live Wikipedia search, and Heritage-101 guides.
async function startTopicsPage() {
    await updateHeader();
    const collectionNav = document.querySelector("#wikiCollections");
    const results = document.querySelector("#wikiResults");
    const title = document.querySelector("#wikiResultsTitle");
    const description = document.querySelector("#wikiResultsDescription");
    const kicker = document.querySelector("#wikiResultsKicker");
    const retry = document.querySelector("#retryWiki");
    let currentSlug = "ancient-india";

    const loadCollection = async (slug, updateAddress = true) => {
        currentSlug = slug; retry.hidden = true; kicker.textContent = "Wikipedia collection";
        results.innerHTML = '<div class="empty-state">Loading heritage articles…</div>';
        collectionNav.querySelectorAll("[data-wiki-collection]").forEach(button => button.classList.toggle("active", button.dataset.wikiCollection === slug));
        try {
            const data = await api(`/api/explore/articles/${encodeURIComponent(slug)}`);
            title.textContent = data.collection.name; description.textContent = data.collection.description;
            renderWikiCards(data.articles, results);
            if (updateAddress) history.pushState({}, "", `/explore/${slug}`);
        } catch (error) {
            title.textContent = "Articles are temporarily unavailable"; description.textContent = error.message;
            results.innerHTML = '<div class="empty-state">Wikipedia could not be reached through either source. Try again in a moment; your community guides are still available below.</div>';
            retry.hidden = false;
        }
    };

    try {
        const { collections } = await api("/api/explore/collections");
        const requested = location.pathname.split("/").filter(Boolean)[1];
        currentSlug = legacyExploreLinks[requested] || (collections.some(item => item.slug === requested) ? requested : collections[0].slug);
        collectionNav.innerHTML = collections.map(item => `<button type="button" class="wiki-collection-chip" data-wiki-collection="${item.slug}"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.description)}</span></button>`).join("");
        collectionNav.querySelectorAll("[data-wiki-collection]").forEach(button => button.addEventListener("click", () => loadCollection(button.dataset.wikiCollection)));
        await loadCollection(currentSlug, false);
    } catch (error) { collectionNav.innerHTML = `<span class="empty-state">${escapeHtml(error.message)}</span>`; }

    document.querySelector("#wikiSearchForm").addEventListener("submit", async (event) => {
        event.preventDefault(); retry.hidden = true;
        const query = document.querySelector("#wikiSearchInput").value.trim();
        results.innerHTML = '<div class="empty-state">Searching Wikipedia…</div>';
        try {
            const data = await api(`/api/explore/search?q=${encodeURIComponent(query)}`);
            kicker.textContent = "Wikipedia search"; title.textContent = `Results for “${data.query}”`; description.textContent = "Search results are supplied live by Wikipedia.";
            renderWikiCards(data.articles, results);
        } catch (error) { title.textContent = "Search unavailable"; description.textContent = error.message; results.innerHTML = '<div class="empty-state">Please try another search in a moment.</div>'; }
    });
    retry.addEventListener("click", () => loadCollection(currentSlug, false));
    loadCommunityArchive();
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
