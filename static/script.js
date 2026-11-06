
const uploadBtn = document.getElementById("uploadBtn");
const audioInput = document.getElementById("audio");
const statusText = document.getElementById("status");
const transcriptText = document.getElementById("transcript");

uploadBtn.addEventListener("click", async () => {
    const file = audioInput.files[0];

    if (!file) {
        alert("Please select an audio recording.");
        return;
    }

    const formData = new FormData();
    formData.append("audio", file);

    uploadBtn.disabled = true;
    statusText.textContent = "AI is processing your recording...";
    transcriptText.textContent = "";

    try {
        const response = await fetch("/api/process", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Request failed");
        }

        transcriptText.textContent = data.transcript;
        statusText.textContent = "Transcription complete!";

    } catch (error) {
        statusText.textContent = "Error: " + error.message;

    } finally {
        uploadBtn.disabled = false;
    }
});
