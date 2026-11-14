// --------------------------------------------------
// Shared Heritage-101 header
// Every page uses this file for the mobile menu and account dropdown.
// --------------------------------------------------
(function startSharedHeader() {
    const menuButton = document.getElementById("menuButton");
    const siteNav = document.getElementById("siteNav");
    // Add the gallery to the shared navigation before wiring mobile links.
    if (siteNav) {
        const galleryLink = document.createElement("a");
        galleryLink.className = "nav-link";
        galleryLink.href = "/3d";
        galleryLink.textContent = "3D View";
        if (location.pathname === "/3d") {
            galleryLink.classList.add("active");
            galleryLink.setAttribute("aria-current", "page");
        }
        siteNav.insertBefore(galleryLink, siteNav.querySelector("[data-account-menu]"));
    }
    const accountSlot = document.querySelector("[data-account-menu]");

    // Add the graph to the common navigation on every page.
    if (siteNav && !siteNav.querySelector('a[href="/knowledge-graph"]')) {
        const graphLink = document.createElement("a");
        graphLink.href = "/knowledge-graph";
        graphLink.className = "nav-link";
        graphLink.textContent = "Knowledge graph";
        if (location.pathname === "/knowledge-graph") {
            graphLink.classList.add("active");
            graphLink.setAttribute("aria-current", "page");
        }
        siteNav.insertBefore(graphLink, accountSlot || null);
    }

    // Close the phone navigation after a link is selected.
    function closeNavigation() {
        if (!menuButton || !siteNav) return;
        siteNav.classList.remove("open");
        menuButton.setAttribute("aria-expanded", "false");
        document.body.classList.remove("menu-open");
    }

    if (menuButton && siteNav) {
        menuButton.addEventListener("click", () => {
            const isOpen = siteNav.classList.toggle("open");
            menuButton.setAttribute("aria-expanded", String(isOpen));
            document.body.classList.toggle("menu-open", isOpen);
        });

        siteNav.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeNavigation);
        });
    }

    // Read the signed-in account once and reuse it on the current page.
    const userPromise = fetch("/api/auth/me")
        .then((response) => response.ok ? response.json() : { user: null })
        .then((data) => data.user || null)
        .catch(() => null);

    // Build either a Sign in link or the signed-in account dropdown.
    async function renderAccountMenu() {
        const user = await userPromise;
        if (!accountSlot) return user;

        if (!user) {
            accountSlot.innerHTML = '<a class="nav-link nav-cta" href="/account">Sign in <span aria-hidden="true">→</span></a>';
            return null;
        }

        accountSlot.innerHTML = `
            <div class="account-dropdown">
                <button class="nav-link nav-cta account-menu-button" type="button" aria-expanded="false" aria-haspopup="true">
                    Account <span aria-hidden="true">▾</span>
                </button>
                <div class="account-dropdown-menu" hidden>
                    <span class="account-email">${escapeText(user.email)}</span>
                    <a href="/contributions">My contributions</a>
                    ${user.role === "admin" ? '<a href="/admin">Review contributions</a>' : ""}
                    <button type="button" data-shared-logout>Sign out</button>
                </div>
            </div>`;

        const trigger = accountSlot.querySelector(".account-menu-button");
        const dropdown = accountSlot.querySelector(".account-dropdown-menu");

        function closeDropdown() {
            dropdown.hidden = true;
            trigger.setAttribute("aria-expanded", "false");
        }

        trigger.addEventListener("click", (event) => {
            event.stopPropagation();
            const willOpen = dropdown.hidden;
            dropdown.hidden = !willOpen;
            trigger.setAttribute("aria-expanded", String(willOpen));
        });

        document.addEventListener("click", (event) => {
            if (!accountSlot.contains(event.target)) closeDropdown();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeDropdown();
        });

        accountSlot.querySelector("[data-shared-logout]").addEventListener("click", async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/";
        });

        return user;
    }

    // Escape the email before inserting it into the dropdown template.
    function escapeText(value) {
        const box = document.createElement("div");
        box.textContent = String(value || "");
        return box.innerHTML;
    }

    const ready = renderAccountMenu();
    window.HeritageHeader = {
        getUser: () => ready,
        closeNavigation,
    };
})();
