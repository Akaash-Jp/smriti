// --------------------------------------------------
// 1. Find the page elements used by the interactions.
// Keeping these at the top makes the rest of the file easy to read.
// --------------------------------------------------
const header = document.querySelector(".site-header");
const menuButton = document.getElementById("menuButton");
const siteNav = document.getElementById("siteNav");
const navLinks = document.querySelectorAll(".nav-link");
const revealItems = document.querySelectorAll(".reveal");
const categoryButtons = document.querySelectorAll(".round-link");
const playPreview = document.getElementById("playPreview");
const toast = document.getElementById("toast");

const uploadBtn = document.getElementById("uploadBtn");
const audioInput = document.getElementById("audio");
const fileDrop = document.querySelector(".file-drop");
const uploadPanel = document.querySelector(".upload-panel");
const fileLabel = document.getElementById("fileLabel");
const statusText = document.getElementById("status");
const resultPanel = document.getElementById("resultPanel");
const transcriptText = document.getElementById("transcript");
const transcriptReview = document.getElementById("transcriptReview");
const reviewSummary = document.getElementById("reviewSummary");
const reviewAdditions = document.getElementById("reviewAdditions");
const reviewQuestions = document.getElementById("reviewQuestions");
const generateGuideBtn = document.getElementById("generateGuideBtn");
const guideEditor = document.getElementById("guideEditor");
const guideStatus = document.getElementById("guideStatus");
const guideTitle = document.getElementById("guideTitle");
const guideIntroduction = document.getElementById("guideIntroduction");
const guideTopic = document.getElementById("guideTopic");
const guideRegion = document.getElementById("guideRegion");
const guideMaterials = document.getElementById("guideMaterials");
const guideTools = document.getElementById("guideTools");
const guideSignificance = document.getElementById("guideSignificance");
const guideSteps = document.getElementById("guideSteps");
const addStepBtn = document.getElementById("addStepBtn");
const guideAttribution = document.getElementById("guideAttribution");
const guideConsent = document.getElementById("guideConsent");
const saveGuideBtn = document.getElementById("saveGuideBtn");
const submitGuideBtn = document.getElementById("submitGuideBtn");
const tutorialPreview = document.getElementById("tutorialPreview");
let currentGuide = null;
let currentTranscriptReview = null;
let currentContributionId = null;
let signedInUser = null;
const pendingDraftKey = "smritiPendingContribution";

// Read JSON safely even when Flask returns a size-limit or server error page.
async function readApiResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const fallback = response.status === 413
            ? "This recording is larger than 20 MB. Choose a smaller file."
            : "Smriti could not complete this request. Please try again.";
        throw new Error(data.error || fallback);
    }
    return data;
}

// A new recording or transcript must never reuse an older generated tutorial.
function resetGuideEditor() {
    currentGuide = null;
    currentTranscriptReview = null;
    currentContributionId = null;
    guideEditor.hidden = true;
    transcriptReview.hidden = true;
    reviewSummary.textContent = "";
    reviewAdditions.replaceChildren();
    reviewQuestions.replaceChildren();
    guideSteps.replaceChildren();
    guideStatus.textContent = "";
}

// Show exactly what the reviewer added and what still needs a human answer.
function renderTranscriptReview(review) {
    currentTranscriptReview = review;
    reviewSummary.textContent = review.productive_summary;
    reviewAdditions.replaceChildren(); reviewQuestions.replaceChildren();

    if (review.added_steps.length) {
        const heading = document.createElement("strong"); heading.textContent = "AI-added practical details";
        const list = document.createElement("ul");
        review.added_steps.forEach((addition) => {
            const item = document.createElement("li");
            item.textContent = `${addition.detail} — ${addition.why_needed} (${addition.confidence} confidence)`;
            list.append(item);
        });
        reviewAdditions.append(heading, list);
    }
    if (review.review_questions.length) {
        const heading = document.createElement("strong"); heading.textContent = "Please verify before publishing";
        const list = document.createElement("ul");
        review.review_questions.forEach((question) => { const item = document.createElement("li"); item.textContent = question; list.append(item); });
        reviewQuestions.append(heading, list);
    }
    transcriptReview.hidden = false;
}

const recordButton = document.getElementById("recordButton");
const stopButton = document.getElementById("stopButton");
const recordingTime = document.getElementById("recordingTime");
const voiceVisual = document.getElementById("voiceVisual");
const recorderNote = document.getElementById("recorderNote");
const recordingPreview = document.getElementById("recordingPreview");
const recordingAudio = document.getElementById("recordingAudio");
const previewPlay = document.getElementById("previewPlay");
const previewTrackFill = document.getElementById("previewTrackFill");
const previewDuration = document.getElementById("previewDuration");
const secureRecorderLink = document.getElementById("secureRecorderLink");

// These values remember the current recording between button clicks.
let mediaRecorder = null;
let recordingStream = null;
let recordingTimer = null;
let recordingSeconds = 0;
let audioChunks = [];
let selectedAudioFile = null;
let recordingUrl = null;
let recorderIsAvailable = true;

// --------------------------------------------------
// 2. Add a solid background to the header after scrolling.
// This keeps the navigation readable over every section.
// --------------------------------------------------
function updateHeader() {
    header.classList.toggle("scrolled", window.scrollY > 24);
}

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

// --------------------------------------------------
// 3. Open and close the navigation menu on small screens.
// --------------------------------------------------
function closeMenu() {
    siteNav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
}

menuButton.addEventListener("click", () => {
    const menuIsOpen = siteNav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(menuIsOpen));
    document.body.classList.toggle("menu-open", menuIsOpen);
});

navLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
});

// --------------------------------------------------
// 4. Show page blocks gently as they enter the screen.
// IntersectionObserver watches visibility without slowing down scrolling.
// --------------------------------------------------
const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.14 });

revealItems.forEach((item) => revealObserver.observe(item));

// --------------------------------------------------
// 5. Keep the current section highlighted in the navigation.
// --------------------------------------------------
const pageSections = document.querySelectorAll("#home, #explore, #contribute");

const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        navLinks.forEach((link) => link.classList.remove("active"));
        const matchingLink = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (matchingLink) matchingLink.classList.add("active");
    });
}, { rootMargin: "-35% 0px -55% 0px" });

pageSections.forEach((section) => sectionObserver.observe(section));

// --------------------------------------------------
// 6. Reuse one small toast for features planned for the next pages.
// --------------------------------------------------
let toastTimer;

function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("visible");

    toastTimer = window.setTimeout(() => {
        toast.classList.remove("visible");
    }, 3200);
}

playPreview.addEventListener("click", () => {
    showToast("The full silk-weaving film will arrive with the story pages.");
});

categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const category = button.dataset.category;
        showToast(`${category} will open as a dedicated collection in the next phase.`);
    });
});

// --------------------------------------------------
// 7. Record a new voice sample directly in the browser.
// The browser handles the microphone; no extra library is required.
// --------------------------------------------------
function formatRecordingTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
}

function stopMicrophoneStream() {
    if (!recordingStream) return;
    recordingStream.getTracks().forEach((track) => track.stop());
    recordingStream = null;
}

function findSupportedRecordingType() {
    const choices = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    return choices.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

// Show recorder feedback in one consistent place and colour.
function setRecorderMessage(message, messageType = "normal") {
    recorderNote.textContent = message;
    recorderNote.classList.toggle("error", messageType === "error");
    recorderNote.classList.toggle("success", messageType === "success");
}

// Microphones work on HTTPS pages and on localhost during development.
// A normal HTTP network address, such as 192.168.x.x, is blocked by browsers.
function checkRecorderAvailability() {
    const browserHasRecorder = Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);

    if (!window.isSecureContext) {
        recorderIsAvailable = false;
        recordButton.disabled = true;
        setRecorderMessage(
            "Microphone access is blocked on this HTTP address. Open the site through HTTPS or localhost.",
            "error"
        );

        // This link fixes the common case where Flask is running on this same computer.
        const localPort = window.location.port ? `:${window.location.port}` : "";
        secureRecorderLink.href = `http://127.0.0.1${localPort}${window.location.pathname}#contribute`;
        secureRecorderLink.textContent = "Open the microphone-safe local address";
        secureRecorderLink.hidden = false;
        return false;
    }

    // Some website preview panels use an iframe that does not permit microphones.
    const permissionPolicy = document.permissionsPolicy || document.featurePolicy;
    if (permissionPolicy?.allowsFeature && !permissionPolicy.allowsFeature("microphone")) {
        recorderIsAvailable = false;
        recordButton.disabled = true;
        setRecorderMessage(
            "This embedded preview blocks microphone access. Open the website in a normal browser tab.",
            "error"
        );
        secureRecorderLink.href = window.location.href;
        secureRecorderLink.target = "_blank";
        secureRecorderLink.rel = "noreferrer";
        secureRecorderLink.textContent = "Open this site in a normal browser tab";
        secureRecorderLink.hidden = false;
        return false;
    }

    if (!browserHasRecorder) {
        recorderIsAvailable = false;
        recordButton.disabled = true;
        setRecorderMessage(
            "This browser does not support live audio recording. Use a current browser or upload a file below.",
            "error"
        );
        return false;
    }

    recorderIsAvailable = true;
    recordButton.disabled = false;
    secureRecorderLink.hidden = true;
    setRecorderMessage("Press start, allow microphone access, and begin speaking.");
    return true;
}

// Turn technical browser error names into instructions a visitor can act on.
function describeMicrophoneError(error) {
    if (error.name === "NotAllowedError" && window.self !== window.top) {
        return "This preview may be blocking the microphone. Open the website in a normal browser tab and allow Microphone there.";
    }

    const messages = {
        NotAllowedError: "Microphone permission is blocked. Use the lock icon beside the address, allow Microphone, then reload the page.",
        NotFoundError: "No microphone was found. Connect or enable a microphone, then try again.",
        NotReadableError: "The microphone is busy in another app. Close the other recorder or call, then try again.",
        AbortError: "The browser stopped opening the microphone. Please try once more.",
        SecurityError: "The browser blocked microphone access for this page. Use HTTPS or localhost.",
        TypeError: "The microphone cannot be used from this page address. Use HTTPS or localhost."
    };

    return messages[error.name] || `The microphone could not start (${error.name || "unknown error"}). Try reloading or use file upload.`;
}

async function startRecording() {
    if (!recorderIsAvailable || !checkRecorderAvailability()) return;

    try {
        setRecorderMessage("Waiting for microphone permission…");
        recordingStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        const supportedType = findSupportedRecordingType();
        const options = supportedType
            ? { mimeType: supportedType, audioBitsPerSecond: 128000 }
            : { audioBitsPerSecond: 128000 };

        mediaRecorder = new MediaRecorder(recordingStream, options);
        audioChunks = [];

        mediaRecorder.addEventListener("dataavailable", (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener("error", (event) => {
            window.clearInterval(recordingTimer);
            recordingTimer = null;
            voiceVisual.classList.remove("recording");
            recordButton.disabled = false;
            stopButton.disabled = true;
            stopMicrophoneStream();
            setRecorderMessage(
                `Recording stopped because of a browser error: ${event.error?.message || "unknown error"}`,
                "error"
            );
        });

        mediaRecorder.addEventListener("stop", () => {
            const audioType = mediaRecorder.mimeType || supportedType || "audio/webm";
            const extension = audioType.includes("mp4") ? "mp4" : audioType.includes("ogg") ? "ogg" : "webm";
            const audioBlob = new Blob(audioChunks, { type: audioType });

            if (audioBlob.size === 0) {
                selectedAudioFile = null;
                setRecorderMessage("No audio was captured. Check the microphone and record again.", "error");
                stopMicrophoneStream();
                return;
            }

            selectedAudioFile = new File(
                [audioBlob],
                `smriti-recording-${Date.now()}.${extension}`,
                { type: audioType }
            );

            if (recordingUrl) URL.revokeObjectURL(recordingUrl);
            recordingUrl = URL.createObjectURL(audioBlob);
            recordingAudio.src = recordingUrl;
            recordingPreview.hidden = false;
            previewPlay.textContent = "▶";
            previewTrackFill.style.width = "0%";
            // WebM metadata may report Infinity/NaN, so trust the timer used while recording.
            previewDuration.textContent = formatRecordingTime(recordingSeconds);

            audioInput.value = "";
            fileLabel.textContent = "Live recording selected";
            const sizeInKilobytes = Math.max(1, Math.round(audioBlob.size / 1024));
            setRecorderMessage(
                `Recording ready (${sizeInKilobytes} KB). Play it back, then transcribe it below.`,
                "success"
            );
            stopMicrophoneStream();
        });

        // Collect one chunk per second instead of holding everything until Stop.
        mediaRecorder.start(1000);
        recordingSeconds = 0;
        recordingTime.textContent = "00:00";
        setRecorderMessage("Recording now — speak clearly and stay near the microphone.");
        voiceVisual.classList.add("recording");
        recordButton.disabled = true;
        stopButton.disabled = false;

        recordingTimer = window.setInterval(() => {
            recordingSeconds += 1;
            recordingTime.textContent = formatRecordingTime(recordingSeconds);
        }, 1000);
    } catch (error) {
        console.error("Microphone start failed:", error);
        window.clearInterval(recordingTimer);
        recordingTimer = null;
        voiceVisual.classList.remove("recording");
        recordButton.disabled = false;
        stopButton.disabled = true;
        stopMicrophoneStream();
        setRecorderMessage(describeMicrophoneError(error), "error");
    }
}

function stopRecording() {
    if (!mediaRecorder || mediaRecorder.state !== "recording") return;

    mediaRecorder.stop();
    window.clearInterval(recordingTimer);
    recordingTimer = null;
    voiceVisual.classList.remove("recording");
    recordButton.disabled = false;
    stopButton.disabled = true;
    setRecorderMessage("Finishing the recording…");
}

recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

// --------------------------------------------------
// 8. Show the chosen filename and support simple drag-and-drop.
// --------------------------------------------------
function showSelectedFile() {
    const file = audioInput.files[0];
    selectedAudioFile = file || null;
    fileLabel.textContent = file ? file.name : "Choose an audio recording";

    if (file) {
        resetGuideEditor();
        resultPanel.classList.remove("visible");
        transcriptText.value = "";
        recordingPreview.hidden = true;
        setRecorderMessage("Uploaded file selected. It is ready to transcribe.", "success");
    }
}

audioInput.addEventListener("change", showSelectedFile);

["dragenter", "dragover"].forEach((eventName) => {
    fileDrop.addEventListener(eventName, (event) => {
        event.preventDefault();
        fileDrop.classList.add("drag-over");
    });
});

// The custom player keeps playback inside the dark visual design.
previewPlay.addEventListener("click", async () => {
    if (!recordingAudio.src) return;
    if (recordingAudio.paused) {
        await recordingAudio.play();
    } else {
        recordingAudio.pause();
    }
});

recordingAudio.addEventListener("loadedmetadata", () => {
    // Some browsers leave WebM duration unknown. Keep the timer value in that case.
    if (Number.isFinite(recordingAudio.duration) && recordingAudio.duration > 0) {
        previewDuration.textContent = formatRecordingTime(Math.round(recordingAudio.duration));
    }
});

recordingAudio.addEventListener("timeupdate", () => {
    const progress = recordingAudio.duration ? (recordingAudio.currentTime / recordingAudio.duration) * 100 : 0;
    previewTrackFill.style.width = `${progress}%`;
});

recordingAudio.addEventListener("play", () => { previewPlay.textContent = "Ⅱ"; });
recordingAudio.addEventListener("pause", () => { previewPlay.textContent = "▶"; });
recordingAudio.addEventListener("ended", () => {
    previewPlay.textContent = "▶";
    previewTrackFill.style.width = "0%";
});

["dragleave", "drop"].forEach((eventName) => {
    fileDrop.addEventListener(eventName, (event) => {
        event.preventDefault();
        fileDrop.classList.remove("drag-over");
    });
});

fileDrop.addEventListener("drop", (event) => {
    const droppedFile = event.dataTransfer.files[0];
    if (!droppedFile) return;

    const transfer = new DataTransfer();
    transfer.items.add(droppedFile);
    audioInput.files = transfer.files;
    showSelectedFile();
});

// --------------------------------------------------
// 9. Send either the live recording or uploaded file to Flask.
// --------------------------------------------------
uploadBtn.addEventListener("click", async () => {
    const file = selectedAudioFile || audioInput.files[0];

    if (!file) {
        showToast("Record your voice or choose an audio file before starting the transcript.");
        return;
    }

    const formData = new FormData();
    formData.append("audio", file);

    uploadBtn.disabled = true;
    statusText.textContent = "Uploading and preparing the recording…";
    transcriptText.textContent = "";
    resultPanel.classList.remove("visible");

    try {
        const response = await fetch("/api/process", {
            method: "POST",
            body: formData
        });

        const data = await readApiResponse(response);

        resetGuideEditor();
        transcriptText.value = data.transcript;
        statusText.textContent = "English transcript complete with Groq Whisper Large V3.";
        resultPanel.classList.add("visible");
    } catch (error) {
        statusText.textContent = `Error: ${error.message}`;
    } finally {
        uploadBtn.disabled = false;
    }
});

async function loadTopics() {
    const response = await fetch("/api/topics");
    const data = await response.json();
    guideTopic.innerHTML = data.topics.map((topic) => `<option value="${topic.slug}">${topic.name}</option>`).join("");
}

// Build the finished tutorial as safe page elements instead of inserting AI text as HTML.
function renderTutorialPreview(guide = currentGuide) {
    tutorialPreview.replaceChildren();
    if (!guide) return;

    const shell = document.createElement("div"); shell.className = "tutorial-shell";
    const header = document.createElement("header"); header.className = "tutorial-header";
    const mainIcon = document.createElement("span"); mainIcon.className = "tutorial-main-icon"; mainIcon.textContent = "✦";
    const title = document.createElement("h3"); title.textContent = guide.title || "Untitled heritage tutorial";
    const introduction = document.createElement("p"); introduction.textContent = guide.introduction || "A step-by-step heritage guide";
    header.append(mainIcon, title, introduction); shell.append(header);

    // Materials and tools appear as a compact preparation block like the reference.
    const needs = document.createElement("section"); needs.className = "tutorial-needs";
    const needsTitle = document.createElement("h4"); needsTitle.textContent = "Materials needed";
    const materials = document.createElement("p");
    materials.textContent = (guide.materials || []).map((item) => `${item.name}${item.quantity ? ` (${item.quantity})` : ""}`).join("  ·  ") || "No materials listed";
    const tools = document.createElement("p"); tools.className = "tutorial-tools";
    tools.textContent = (guide.tools || []).length ? `Also required: ${(guide.tools || []).join(" · ")}` : "No additional tools listed";
    needs.append(needsTitle, materials, tools); shell.append(needs);

    // Connected cards turn each AI step into one easy-to-follow action.
    const icons = ["◉", "◇", "⌁", "☼", "♨", "◌", "✦"];
    const sequence = document.createElement("section"); sequence.className = "tutorial-sequence";
    (guide.steps || []).forEach((step, index) => {
        const card = document.createElement("article"); card.className = "tutorial-step";
        const heading = document.createElement("div"); heading.className = "tutorial-step-heading";
        const icon = document.createElement("span"); icon.className = "tutorial-step-icon"; icon.textContent = icons[index % icons.length];
        const words = document.createElement("div");
        const number = document.createElement("span"); number.className = "tutorial-step-number"; number.textContent = `STEP ${String(index + 1).padStart(2, "0")}`;
        const stepTitle = document.createElement("h4"); stepTitle.textContent = step.title || "Untitled step";
        const description = document.createElement("p"); description.textContent = step.description || "Add an explanation for this step.";
        words.append(number, stepTitle); heading.append(icon, words); card.append(heading, description);
        if (step.tip) { const tip = document.createElement("p"); tip.className = "tutorial-tip"; tip.textContent = `Tip: ${step.tip}`; card.append(tip); }
        if (step.warning) { const warning = document.createElement("p"); warning.className = "tutorial-warning"; warning.textContent = `Take care: ${step.warning}`; card.append(warning); }
        sequence.append(card);
        if (index < guide.steps.length - 1) { const arrow = document.createElement("span"); arrow.className = "tutorial-arrow"; arrow.textContent = "↓"; sequence.append(arrow); }
    });
    shell.append(sequence);

    const finish = document.createElement("footer"); finish.className = "tutorial-finish";
    const check = document.createElement("span"); check.textContent = "✓";
    const finishTitle = document.createElement("strong"); finishTitle.textContent = "Tutorial ready to review";
    const significance = document.createElement("p"); significance.textContent = guide.cultural_significance || "Check every detail with the contributor before publishing.";
    finish.append(check, finishTitle, significance); shell.append(finish); tutorialPreview.append(shell);
}

function renderGuideSteps() {
    // Build form fields as elements so transcript text can never become executable HTML.
    guideSteps.replaceChildren();
    ((currentGuide && currentGuide.steps) || []).forEach((step, index) => {
        const box = document.createElement("div"); box.className = "guide-step";
        const heading = document.createElement("strong"); heading.textContent = `Step ${index + 1}`;
        const title = document.createElement("input"); title.dataset.field = "title"; title.value = step.title || "";
        const description = document.createElement("textarea"); description.dataset.field = "description"; description.rows = 3; description.value = step.description || "";
        const tip = document.createElement("input"); tip.dataset.field = "tip"; tip.placeholder = "Tip (optional)"; tip.value = step.tip || "";
        const warning = document.createElement("input"); warning.dataset.field = "warning"; warning.placeholder = "Warning (optional)"; warning.value = step.warning || "";
        const remove = document.createElement("button"); remove.type = "button"; remove.dataset.removeStep = index; remove.textContent = "Remove step";
        box.append(heading, title, description, tip, warning, remove); guideSteps.append(box);
    });
    guideSteps.querySelectorAll("[data-remove-step]").forEach((button) => button.addEventListener("click", () => { currentGuide.steps.splice(Number(button.dataset.removeStep), 1); renderGuideSteps(); }));
    renderTutorialPreview();
}

generateGuideBtn.addEventListener("click", async () => {
    const originalTranscript = transcriptText.value.trim();
    if (!originalTranscript) {
        guideStatus.textContent = "Add or transcribe some words before generating a tutorial.";
        return;
    }
    generateGuideBtn.disabled = true; guideStatus.textContent = "Reviewing the transcript and finding missing practical steps…";
    try {
        // The stronger reviewer cleans the speech before the tutorial model sees it.
        const reviewResponse = await fetch("/api/review-transcript", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: originalTranscript }) });
        const reviewData = await readApiResponse(reviewResponse);
        renderTranscriptReview(reviewData.review);
        transcriptText.value = reviewData.review.practical_transcript;
        guideStatus.textContent = "Practical transcript ready. Building the step-by-step tutorial…";

        const response = await fetch("/api/generate-guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: reviewData.review.practical_transcript }) });
        const data = await readApiResponse(response);
        currentGuide = data.guide; currentGuide.transcript_review = currentTranscriptReview; currentContributionId = null; guideEditor.hidden = false; guideTitle.value = currentGuide.title || ""; guideIntroduction.value = currentGuide.introduction || ""; guideRegion.value = currentGuide.region || ""; guideMaterials.value = (currentGuide.materials || []).map(item => `${item.name || ""}${item.quantity ? ` — ${item.quantity}` : ""}`).join("\n"); guideTools.value = (currentGuide.tools || []).join("\n"); guideSignificance.value = currentGuide.cultural_significance || ""; await loadTopics(); guideTopic.value = currentGuide.suggested_topic_slug || "techniques"; renderGuideSteps(); guideStatus.textContent = "Tutorial ready. Check the AI additions and every step before saving.";
    } catch (error) { guideStatus.textContent = error.message; } finally { generateGuideBtn.disabled = false; }
});

addStepBtn.addEventListener("click", () => { if (!currentGuide) return; currentGuide.steps.push({ title: "", description: "", tip: "", warning: "" }); renderGuideSteps(); });

function collectGuide() {
    currentGuide.title = guideTitle.value.trim(); currentGuide.introduction = guideIntroduction.value.trim(); currentGuide.region = guideRegion.value.trim(); currentGuide.materials = guideMaterials.value.split("\n").map(line => line.trim()).filter(Boolean).map(line => { const parts = line.split(/\s+[—-]\s+/); return { name: parts[0], quantity: parts.slice(1).join(" — ") }; }); currentGuide.tools = guideTools.value.split("\n").map(line => line.trim()).filter(Boolean); currentGuide.cultural_significance = guideSignificance.value.trim(); currentGuide.steps = [...guideSteps.querySelectorAll(".guide-step")].map((box, index) => ({ number: index + 1, title: box.querySelector('[data-field="title"]').value.trim(), description: box.querySelector('[data-field="description"]').value.trim(), tip: box.querySelector('[data-field="tip"]').value.trim(), warning: box.querySelector('[data-field="warning"]').value.trim() }));
    currentGuide.suggested_topic_slug = guideTopic.value;
    return currentGuide;
}

// Package one contribution consistently for first saves, updates, and sign-in recovery.
function buildContributionPayload() {
    return { title: collectGuide().title, guide: currentGuide, transcript: transcriptText.value, topic_slug: guideTopic.value, attribution: guideAttribution.value, consent: guideConsent.checked };
}

async function saveGuide(submit = false) {
    const payload = buildContributionPayload(); guideStatus.textContent = submit ? "Submitting…" : "Saving draft…";
    try {
        if (!signedInUser) {
            // The save click is remembered through sign-in instead of losing the tutorial.
            sessionStorage.setItem(pendingDraftKey, JSON.stringify({ payload, submit }));
            location.href = `/account?next=${encodeURIComponent("/?resume=pending#contribute")}`;
            return;
        }
        const saveUrl = currentContributionId ? `/api/contributions/${currentContributionId}` : "/api/contributions";
        const response = await fetch(saveUrl, { method: currentContributionId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const saved = await readApiResponse(response);
        currentContributionId = saved.id;
        if (submit) {
            const submitResponse = await fetch(`/api/contributions/${saved.id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
            const submitted = await submitResponse.json();
            if (!submitResponse.ok) throw new Error(submitted.error);
        }
        sessionStorage.removeItem(pendingDraftKey);
        guideStatus.textContent = submit ? "Submitted for administrator review. Opening My Contributions…" : "Draft saved. Opening My Contributions…";
        setTimeout(() => { location.href = "/contributions"; }, 700);
    } catch (error) { guideStatus.textContent = error.message; }
}

saveGuideBtn.addEventListener("click", () => saveGuide(false)); submitGuideBtn.addEventListener("click", () => saveGuide(true));

// Keep the polished preview synchronized with every field the contributor edits.
guideEditor.addEventListener("input", (event) => {
    if (!currentGuide || !event.target.matches("input, textarea, select")) return;
    collectGuide(); renderTutorialPreview();
});

// --------------------------------------------------
// 10. Stop microphone access if the visitor leaves while recording.
// --------------------------------------------------
window.addEventListener("beforeunload", stopMicrophoneStream);

// --------------------------------------------------
// 11. Check microphone support as soon as the page is ready.
// --------------------------------------------------
checkRecorderAvailability();

// --------------------------------------------------
// 12. Show account state and reopen an editable draft when requested.
// --------------------------------------------------
async function prepareContributionAccount() {
    try {
        const response = await fetch("/api/auth/me");
        const data = await response.json(); signedInUser = data.user;
        const accountNav = document.getElementById("accountNav");
        const accountNote = document.getElementById("accountNote");
        if (signedInUser) { accountNav.textContent = "My archive →"; accountNav.href = "/contributions"; accountNote.textContent = `Signed in as ${signedInUser.email}`; }
        const pending = sessionStorage.getItem(pendingDraftKey);
        if (signedInUser && new URLSearchParams(location.search).get("resume") === "pending" && pending) {
            const savedState = JSON.parse(pending); const payload = savedState.payload;
            currentGuide = payload.guide; currentTranscriptReview = currentGuide.transcript_review || null; transcriptText.value = payload.transcript; guideTitle.value = currentGuide.title || ""; guideIntroduction.value = currentGuide.introduction || ""; guideRegion.value = currentGuide.region || ""; guideMaterials.value = (currentGuide.materials || []).map(material => `${material.name || ""}${material.quantity ? ` — ${material.quantity}` : ""}`).join("\n"); guideTools.value = (currentGuide.tools || []).join("\n"); guideSignificance.value = currentGuide.cultural_significance || ""; guideAttribution.value = payload.attribution || ""; guideConsent.checked = Boolean(payload.consent); if (currentTranscriptReview) renderTranscriptReview(currentTranscriptReview);
            await loadTopics(); guideTopic.value = payload.topic_slug; renderGuideSteps(); resultPanel.classList.add("visible"); guideEditor.hidden = false; uploadPanel.classList.add("visible"); guideStatus.textContent = "Signed in. Saving your recovered draft…";
            await saveGuide(Boolean(savedState.submit)); return;
        }
        const editId = new URLSearchParams(location.search).get("edit");
        if (!editId) return;
        if (!signedInUser) { location.href = `/account?next=${encodeURIComponent(location.pathname + location.search + "#contribute")}`; return; }
        const editResponse = await fetch(`/api/contributions/${editId}`); const editData = await editResponse.json();
        if (!editResponse.ok) throw new Error(editData.error);
        const item = editData.contribution; currentContributionId = item.id; currentGuide = item.guide; currentTranscriptReview = currentGuide.transcript_review || null; if (currentTranscriptReview) renderTranscriptReview(currentTranscriptReview);
        transcriptText.value = item.transcript; guideTitle.value = item.title; guideIntroduction.value = currentGuide.introduction || ""; guideRegion.value = currentGuide.region || ""; guideMaterials.value = (currentGuide.materials || []).map(material => `${material.name || ""}${material.quantity ? ` — ${material.quantity}` : ""}`).join("\n"); guideTools.value = (currentGuide.tools || []).join("\n"); guideSignificance.value = currentGuide.cultural_significance || ""; guideAttribution.value = item.attribution || ""; guideConsent.checked = item.consent;
        await loadTopics(); guideTopic.value = item.topic_slug; renderGuideSteps(); resultPanel.classList.add("visible"); guideEditor.hidden = false;
        // A long restored editor may never satisfy the reveal animation threshold.
        // Reveal it directly and scroll to the actual editable content instead.
        uploadPanel.classList.add("visible"); guideStatus.textContent = item.admin_feedback || "Draft reopened for editing.";
        resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { guideStatus.textContent = error.message; }
}
prepareContributionAccount();

// --------------------------------------------------
// 13. Keep the footer year current without manual editing.
// --------------------------------------------------
document.getElementById("currentYear").textContent = new Date().getFullYear();
