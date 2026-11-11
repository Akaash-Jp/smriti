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
const fileLabel = document.getElementById("fileLabel");
const statusText = document.getElementById("status");
const resultPanel = document.getElementById("resultPanel");
const transcriptText = document.getElementById("transcript");

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
        if (category === "Monuments") {
            window.location.href = "/map";
            return;
        }
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

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "The request could not be completed.");
        }

        transcriptText.textContent = data.transcript;
        statusText.textContent = "Transcription complete.";
        resultPanel.classList.add("visible");
    } catch (error) {
        statusText.textContent = `Error: ${error.message}`;
    } finally {
        uploadBtn.disabled = false;
    }
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
// 12. Keep the footer year current without manual editing.
// --------------------------------------------------
document.getElementById("currentYear").textContent = new Date().getFullYear();
