// Each node is a real cultural subject with an article visitors can check.
const graphNodes = [
    ["india","India","Place","India is home to many regional cultural traditions.","India",600,390],
    ["tamil","Tamil Nadu","Place","A southern Indian state with living music, dance and craft traditions.","Tamil_Nadu",400,310],
    ["karnataka","Karnataka","Place","A southern Indian state known for diverse arts and heritage sites.","Karnataka",430,570],
    ["kerala","Kerala","Place","A southwestern Indian state with distinctive performing arts.","Kerala",300,470],
    ["rajasthan","Rajasthan","Place","A northwestern Indian state with rich craft and music traditions.","Rajasthan",800,220],
    ["west-bengal","West Bengal","Place","An eastern Indian state with longstanding art and food traditions.","West_Bengal",900,490],
    ["kanchipuram","Kanchipuram","City","A historic Tamil Nadu city known for temples and silk weaving.","Kanchipuram",205,220],
    ["thanjavur","Thanjavur","City","A Tamil Nadu city associated with Chola heritage, painting and music.","Thanjavur",180,380],
    ["jaipur","Jaipur","City","The capital of Rajasthan, known for its historic architecture and crafts.","Jaipur",990,160],
    ["bharatanatyam","Bharatanatyam","Dance","An Indian classical dance form with roots in Tamil Nadu.","Bharatanatyam",385,135],
    ["kathakali","Kathakali","Dance","A classical dance drama originating in Kerala.","Kathakali",160,585],
    ["yakshagana","Yakshagana","Dance","A traditional theatre form associated with Karnataka.","Yakshagana",390,720],
    ["carnatic","Carnatic music","Music","A classical music tradition of southern India.","Carnatic_music",560,190],
    ["mridangam","Mridangam","Instrument","A double-headed drum used in Carnatic music.","Mridangam",675,105],
    ["veena","Saraswati veena","Instrument","A plucked string instrument used in Indian classical music.","Saraswati_veena",720,275],
    ["kanchi-silk","Kanchipuram silk sari","Craft","Silk saris traditionally woven in and around Kanchipuram.","Kanchipuram_silk_sari",95,95],
    ["tanjore-painting","Tanjore painting","Craft","A painting tradition associated with Thanjavur.","Tanjore_painting",60,365],
    ["blue-pottery","Blue Pottery of Jaipur","Craft","A distinctive glazed pottery tradition of Jaipur.","Blue_Pottery_of_Jaipur",1070,70],
    ["madhubani","Madhubani art","Craft","A painting tradition associated with the Mithila region.","Madhubani_art",1060,365],
    ["brihadisvara","Brihadisvara Temple","Monument","A Chola period temple in Thanjavur and a UNESCO World Heritage Site.","Brihadisvara_Temple",75,485],
    ["hampi","Hampi","Monument","A historic site in Karnataka with Vijayanagara era remains.","Hampi",580,690],
    ["biriyani","Biryani","Food","A rice dish with many regional varieties across South Asia.","Biryani",790,610],
    ["dosa","Dosa","Food","A fermented crepe traditionally associated with South Indian cuisine.","Dosa_(food)",590,550],
    ["modak","Modak","Food","A sweet dumpling especially associated with Ganesh Chaturthi.","Modak",1020,640],
    ["garba","Garba","Dance","A Gujarati dance performed during Navaratri celebrations.","Garba_(dance)",810,395]
].map(([id,name,type,description,source,x,y]) => ({id,name,type,description,source,x,y}));

// Connections describe a limited, sourced relationship, never an invented biography.
const graphEdges = [
    ["india","tamil","contains"],["india","karnataka","contains"],["india","kerala","contains"],["india","rajasthan","contains"],["india","west-bengal","contains"],
    ["tamil","kanchipuram","contains"],["tamil","thanjavur","contains"],["rajasthan","jaipur","contains"],
    ["tamil","bharatanatyam","associated with"],["kerala","kathakali","associated with"],["karnataka","yakshagana","associated with"],["tamil","carnatic","associated with"],
    ["carnatic","mridangam","uses"],["carnatic","veena","uses"],["bharatanatyam","carnatic","accompanied by"],["bharatanatyam","mridangam","accompanied by"],
    ["kanchipuram","kanchi-silk","known for"],["thanjavur","tanjore-painting","known for"],["thanjavur","brihadisvara","located in"],
    ["jaipur","blue-pottery","known for"],["karnataka","hampi","located in"],["tamil","dosa","associated with"],
    ["india","biriyani","found in"],["india","modak","found in"],["india","madhubani","found in"],["india","garba","found in"]
];

// A colour and shape distinguish categories even when several nodes overlap.
const graphTypes = {
    Place: ["#80c9a9","triangle"], City: ["#e8b882","triangle"], Dance: ["#a977f0","diamond"],
    Music: ["#4fc8bf","circle"], Instrument: ["#59b4d4","hexagon"], Craft: ["#efa7cf","square"],
    Monument: ["#f5d88a","star"], Food: ["#fb7775","circle"]
};
const svgNS = "http://www.w3.org/2000/svg";
const canvas = document.getElementById("graphCanvas");
const viewport = document.getElementById("graphViewport");
const byId = Object.fromEntries(graphNodes.map(node => [node.id,node]));
const activeTypes = new Set(Object.keys(graphTypes));
let selected = null, layout = "force", zoom = 1, panX = 0, panY = 0, drag = null;
const wikipedia = title => `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;

// Small SVG helper keeps the graph drawing code readable.
function element(tag, attributes = {}) {
    const item = document.createElementNS(svgNS, tag);
    Object.entries(attributes).forEach(([key,value]) => item.setAttribute(key,String(value)));
    return item;
}

// Four shapes are enough to make categories recognizable without a chart library.
function nodeShape(type, x, y) {
    const [color,shape] = graphTypes[type];
    let item;
    if (shape === "circle") item = element("circle", {cx:x,cy:y,r:15});
    else if (shape === "square") item = element("rect", {x:x-14,y:y-14,width:28,height:28,rx:4});
    else {
        const sides = shape === "triangle" ? 3 : shape === "diamond" ? 4 : shape === "hexagon" ? 6 : 10;
        const points = Array.from({length:sides},(_,index) => {
            const radius = shape === "star" && index % 2 ? 8 : 18;
            const angle = index * Math.PI * 2 / sides - Math.PI / 2;
            return `${x + Math.cos(angle)*radius},${y + Math.sin(angle)*radius}`;
        }).join(" ");
        item = element("polygon", {points});
    }
    item.setAttribute("fill",color);
    return item;
}

// Layout choices rearrange the same underlying cultural data.
function position(node) {
    const index = graphNodes.indexOf(node);
    if (layout === "circle") return {x:600 + Math.cos(index * Math.PI*2/graphNodes.length - Math.PI/2)*390,y:400 + Math.sin(index * Math.PI*2/graphNodes.length - Math.PI/2)*300};
    if (layout === "grid") return {x:135 + index%5*230,y:110 + Math.floor(index/5)*145};
    return {x:node.x,y:node.y};
}

// Filters update nodes and edges together, so lines never point into empty space.
function visibleGraph() {
    const query = document.getElementById("graphSearch").value.trim().toLowerCase();
    const minimum = Number(document.getElementById("graphImportance").value);
    const relation = document.getElementById("graphRelation").value;
    const nodes = graphNodes.filter(node => activeTypes.has(node.type) && (!query || node.name.toLowerCase().includes(query)) && graphEdges.filter(edge => edge[0] === node.id || edge[1] === node.id).length >= minimum);
    const ids = new Set(nodes.map(node => node.id));
    return {nodes,edges:graphEdges.filter(edge => ids.has(edge[0]) && ids.has(edge[1]) && (relation === "all" || edge[2] === relation))};
}

// Rebuild a small SVG whenever a filter changes; all labels stay real text.
function renderGraph() {
    const {nodes,edges} = visibleGraph();
    viewport.replaceChildren();
    viewport.setAttribute("transform",`translate(${panX} ${panY}) scale(${zoom})`);
    edges.forEach(([from,to,relationship]) => {
        const a = position(byId[from]), b = position(byId[to]);
        const line = element("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:"graph-edge"});
        if (selected && (from === selected || to === selected)) line.classList.add("connected");
        line.append(element("title")); line.lastChild.textContent = relationship;
        viewport.append(line);
    });
    nodes.forEach(node => {
        const {x,y} = position(node);
        const group = element("g",{class:`graph-entity${selected === node.id ? " selected" : ""}`,tabindex:0,role:"button","aria-label":`${node.name}, ${node.type}`});
        group.append(nodeShape(node.type,x,y));
        const label = element("text",{x,y:y+35,"text-anchor":"middle"}); label.textContent = node.name; group.append(label);
        group.addEventListener("click",() => selectNode(node.id));
        group.addEventListener("keydown",event => {if (event.key === "Enter" || event.key === " ") {event.preventDefault();selectNode(node.id);}});
        viewport.append(group);
    });
    document.getElementById("graphEmpty").hidden = nodes.length !== 0;
    document.getElementById("graphCounts").textContent = `${nodes.length} nodes  ·  ${edges.length} connections`;
}

// The detail panel links every claim back to a named public source.
function selectNode(id) {
    selected = id;
    const node = byId[id], details = document.getElementById("graphDetails");
    details.replaceChildren();
    const type = document.createElement("span"); type.className = "detail-type"; type.textContent = node.type;
    const title = document.createElement("h3"); title.textContent = node.name;
    const description = document.createElement("p"); description.textContent = node.description;
    const source = document.createElement("a"); source.href = wikipedia(node.source); source.target = "_blank"; source.rel = "noopener noreferrer"; source.textContent = "Read on Wikipedia ↗";
    const heading = document.createElement("h4"); heading.textContent = "Connections";
    const list = document.createElement("ul");
    graphEdges.filter(edge => edge[0] === id || edge[1] === id).forEach(edge => {
        const other = byId[edge[0] === id ? edge[1] : edge[0]];
        const row = document.createElement("li"), button = document.createElement("button");
        button.type = "button"; button.textContent = other.name; button.addEventListener("click",() => selectNode(other.id));
        row.append(document.createTextNode(`${edge[2]} `),button); list.append(row);
    });
    details.append(type,title,description,source,heading,list);
    renderGraph();
}

// Populate the category buttons, legend and relationship list from the data.
Object.entries(graphTypes).forEach(([name,[color]]) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "graph-type active"; button.setAttribute("aria-pressed","true");
    const dot = document.createElement("span"); dot.className = "type-dot"; dot.style.background = color; button.append(dot,document.createTextNode(name));
    button.addEventListener("click",() => {activeTypes.has(name) ? activeTypes.delete(name) : activeTypes.add(name); button.classList.toggle("active",activeTypes.has(name)); button.setAttribute("aria-pressed",String(activeTypes.has(name)));renderGraph();});
    document.getElementById("graphTypes").append(button);
    const legend = document.createElement("p"); const marker = dot.cloneNode(); legend.append(marker,document.createTextNode(name)); document.getElementById("graphLegend").append(legend);
});
new Set(graphEdges.map(edge => edge[2])).forEach(name => {const option = document.createElement("option"); option.value = name; option.textContent = name; document.getElementById("graphRelation").append(option);});

// A transformed SVG viewport gives smooth zooming and dragging.
function zoomBy(factor) {zoom = Math.min(2.5,Math.max(.55,zoom*factor));renderGraph();}
canvas.addEventListener("wheel",event => {event.preventDefault();zoomBy(event.deltaY < 0 ? 1.1 : .9);},{passive:false});
canvas.addEventListener("pointerdown",event => {if (event.target.closest(".graph-entity")) return;drag = {x:event.clientX,y:event.clientY,panX,panY};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener("pointermove",event => {if (!drag) return; const bounds = canvas.getBoundingClientRect(); panX = drag.panX + (event.clientX-drag.x)*1200/bounds.width; panY = drag.panY + (event.clientY-drag.y)*800/bounds.height;renderGraph();});
canvas.addEventListener("pointerup",() => {drag = null;});
document.getElementById("graphZoomIn").addEventListener("click",() => zoomBy(1.2));
document.getElementById("graphZoomOut").addEventListener("click",() => zoomBy(.8));
document.getElementById("graphReset").addEventListener("click",() => {zoom=1;panX=0;panY=0;renderGraph();});
document.getElementById("graphSearch").addEventListener("input",renderGraph);
document.getElementById("graphRelation").addEventListener("change",renderGraph);
document.getElementById("graphImportance").addEventListener("input",event => {document.getElementById("importanceValue").textContent=event.target.value;renderGraph();});
document.querySelectorAll("[data-layout]").forEach(button => button.addEventListener("click",() => {layout=button.dataset.layout;document.querySelectorAll("[data-layout]").forEach(item => item.classList.toggle("active",item===button));renderGraph();}));
const requestedNode = new URLSearchParams(location.search).get("node");
if (requestedNode && byId[requestedNode]) selectNode(requestedNode); else renderGraph();
