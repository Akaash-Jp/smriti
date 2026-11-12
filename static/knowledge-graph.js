// A small, curated graph: each item has a category, description and source.
const graphNodes = [
    { id: "tamil-nadu", name: "Tamil Nadu", type: "Place", description: "A southern Indian state associated with many dance, music and textile traditions.", source: "Tamil_Nadu" },
    { id: "bharatanatyam", name: "Bharatanatyam", type: "Art form", description: "An Indian classical dance form associated with Tamil Nadu.", source: "Bharatanatyam" },
    { id: "carnatic", name: "Carnatic music", type: "Music", description: "A classical music tradition of southern India.", source: "Carnatic_music" },
    { id: "mridangam", name: "Mridangam", type: "Instrument", description: "A double-sided drum used in Carnatic music and dance accompaniment.", source: "Mridangam" },
    { id: "kanchipuram", name: "Kanchipuram", type: "Place", description: "A city in Tamil Nadu known for its temples and silk weaving.", source: "Kanchipuram" },
    { id: "silk", name: "Kanchipuram silk sari", type: "Craft", description: "A silk sari tradition woven in and around Kanchipuram.", source: "Kanchipuram_silk_sari" },
    { id: "thanjavur", name: "Thanjavur", type: "Place", description: "A city in Tamil Nadu associated with art, architecture and music.", source: "Thanjavur" },
    { id: "painting", name: "Tanjore painting", type: "Art form", description: "A South Indian painting tradition associated with Thanjavur.", source: "Tanjore_painting" }
];

// Each connection records its source article, so visitors can check the claim.
const graphEdges = [
    ["bharatanatyam", "tamil-nadu", "associated with", "Bharatanatyam"],
    ["bharatanatyam", "carnatic", "accompanied by", "Bharatanatyam"],
    ["carnatic", "mridangam", "uses", "Carnatic_music"],
    ["kanchipuram", "tamil-nadu", "located in", "Kanchipuram"],
    ["silk", "kanchipuram", "woven in and around", "Kanchipuram_silk_sari"],
    ["thanjavur", "tamil-nadu", "located in", "Thanjavur"],
    ["painting", "thanjavur", "associated with", "Tanjore_painting"]
];

const graphContainer = document.getElementById("graph");
const graphDetails = document.getElementById("graphDetails");
const graphSearch = document.getElementById("graphSearch");
const graphFilter = document.getElementById("graphFilter");
let selectedGraphNode = "bharatanatyam";
const articleUrl = title => `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;

// Render the selected item and its connections with safe DOM text, not HTML.
function selectGraphNode(id) {
    selectedGraphNode = id;
    const node = graphNodes.find(item => item.id === id);
    graphDetails.replaceChildren();
    const kind = document.createElement("p"); kind.textContent = node.type;
    const title = document.createElement("h2"); title.textContent = node.name;
    const description = document.createElement("p"); description.textContent = node.description;
    const source = document.createElement("a"); source.href = articleUrl(node.source); source.target = "_blank"; source.rel = "noopener noreferrer"; source.textContent = "Read on Wikipedia ↗";
    const heading = document.createElement("h3"); heading.textContent = "Connections";
    const list = document.createElement("ul");
    graphEdges.filter(edge => edge[0] === id || edge[1] === id).forEach(edge => {
        const other = graphNodes.find(item => item.id === (edge[0] === id ? edge[1] : edge[0]));
        const row = document.createElement("li");
        const link = document.createElement("button"); link.type = "button"; link.textContent = other.name; link.addEventListener("click", () => selectGraphNode(other.id));
        const citation = document.createElement("a"); citation.href = articleUrl(edge[3]); citation.target = "_blank"; citation.rel = "noopener noreferrer"; citation.textContent = " source ↗";
        row.append(document.createTextNode(edge[0] === id ? `${edge[2]} ` : `connected to: `), link, citation); list.append(row);
    });
    graphDetails.append(kind, title, description, source, heading, list);
    renderGraph();
}

// Search and category filters affect the node list; connected items remain clickable.
function renderGraph() {
    const query = graphSearch.value.trim().toLowerCase();
    const visible = graphNodes.filter(node => node.name.toLowerCase().includes(query) && (graphFilter.value === "all" || node.type === graphFilter.value));
    graphContainer.replaceChildren();
    visible.forEach(node => {
        const button = document.createElement("button"); button.type = "button"; button.className = "graph-node"; button.dataset.node = node.id; button.textContent = node.name; button.setAttribute("aria-pressed", String(node.id === selectedGraphNode)); button.addEventListener("click", () => selectGraphNode(node.id)); graphContainer.append(button);
    });
    document.getElementById("graphEmpty").hidden = visible.length > 0;
    drawGraphConnections();
}

// Draw the links between visible nodes after the browser has laid them out.
function drawGraphConnections() {
    graphContainer.querySelector(".graph-lines")?.remove();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("graph-lines"); svg.setAttribute("aria-hidden", "true");
    graphEdges.forEach(edge => {
        const from = graphContainer.querySelector(`[data-node="${edge[0]}"]`);
        const to = graphContainer.querySelector(`[data-node="${edge[1]}"]`);
        if (!from || !to) return;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", from.offsetLeft + from.offsetWidth / 2); line.setAttribute("y1", from.offsetTop + from.offsetHeight / 2);
        line.setAttribute("x2", to.offsetLeft + to.offsetWidth / 2); line.setAttribute("y2", to.offsetTop + to.offsetHeight / 2);
        line.setAttribute("stroke", "#a8905a"); line.setAttribute("stroke-width", "2"); svg.append(line);
    });
    graphContainer.prepend(svg);
}
window.addEventListener("resize", drawGraphConnections);
graphSearch.addEventListener("input", renderGraph);
graphFilter.addEventListener("change", renderGraph);
selectGraphNode(new URLSearchParams(location.search).get("node") === "tamil-nadu" ? "tamil-nadu" : "bharatanatyam");
