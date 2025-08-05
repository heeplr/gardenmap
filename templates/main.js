
/* complete model of garden with plant references to plant palette */
let garden = {};
/* plant palette */
let plants = {};


/* currently selected month view */
let selectedMonth = 1;
let editingPlant = null;

const transform = { x: 0, y: 0, scale: 1, centerX: undefined, centerY: undefined };
let isPanning = false;
let panStart = null;

let dragStart = null;
let selectionDragStartPositions = [];

let shiftKeyPressed = false;

let boxSelectMode = false;
let justSelected = false;
let selectionStart = null;
let selectionRect = null;
let selectedPlants = [];

let showMaxHeight = false;

/* config */
const iconWidth = 5;
const maxPlantHeight = 2.0;


/* ---------------------------------------------------------------------------*/
/* construct printable month names */
const monthNames = [];
for(let i=0; i<12; i++) {
    var objDate = new Date();
    objDate.setDate(1);
    objDate.setMonth(i);
    monthNames[i] = objDate.toLocaleString(navigator.language, { month: "long" });
};
/* load view from browser localstorage */
const savedView = JSON.parse(localStorage.getItem("view") || '{}');
transform.x = savedView.offsetX || 0;
transform.y = savedView.offsetY || 0;
transform.scale = savedView.scale || 1;
selectedMonth = savedView.selectedMonth || 1;

/* our SVG with our map container */
const svg = document.getElementById("gardensvg");
const map = document.getElementById("viewport");


/* ---------------------------------------------------------------------------*/
function saveViewToLocalStorage() {
    localStorage.setItem("view", JSON.stringify({
        'offsetX': transform.x,
        'offsetY': transform.y,
        'scale': transform.scale,
        'selectedMonth': selectedMonth
    }));
}

function loadPlants() {
    /* load plants */
    return fetch('/plants')
        .then(res => res.json())
        .then(data => {
            data.plantlist.forEach(plant => {
                plants[plant['id']] = plant;
            });
        }).then(() => renderPlants());
}

function renderPlants() {
    const el = document.getElementById('plantlist');
    el.innerHTML = '';
    for (const [id, plant] of Object.entries(plants)) {
        const div = document.createElement('div');
        div.className = 'plants-item';
        div.innerText = plant.name;
        div.draggable = true;
        div.ondragstart = e => {
            e.dataTransfer.setData('plant-id', plant.id);
        };
        const img = document.createElement('img');
        img.src = plant['vegetation'][selectedMonth];
        img.align = "right";
        div.appendChild(img);
        el.appendChild(div);
    };
}

function togglePlants() {
    const el = document.getElementById('plants');
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
    if (el.style.display === 'block') renderPlants();
}

function plantsNewPlant() {
    const newPlant = {
        name: 'Neu',
        id: 'new',
        type: '',
        vegetation: Object.fromEntries([...Array(12)].map((_, i) => [i + 1, '/flower.svg']))
    };
    fetch('/plants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPlant)
        }).then(() => loadPlants());
}

function updateIconsByMonth(month) {
    selectedMonth = month;
    saveViewToLocalStorage();
    renderMonth();
    renderGarden();
    renderPlants();
}

function renderMonth() {
    document.getElementById('month').textContent = monthNames[selectedMonth-1];
}

function loadGarden() {
    /* remove all plants */
    document.querySelectorAll('#gardensvg image').forEach(e => e.remove());

    /* load garden */
    return fetch('/garden')
        .then(res => res.json())
        .then(data => {
            /* initialize each plant icon */
            garden = {};
            data.plantlist.forEach(plant => {
                /* store model */
                garden[plant.id] = plant;
            });
        })
        .then(() => { renderGarden(); });
}

function renderGarden() {
    for (const [id, plant] of Object.entries(garden)) {
        /* remove current image */
        if(plant.el) {
            plant.el.remove();
        }
        /* DOM element for this plant */
        let el = null;
        /* visualize max height? */
        if(showMaxHeight) {
            /* calculate color shade from height */
            let color = (255.0 / maxPlantHeight) * plants[plant.plant_id].max_height;
            el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            el.setAttribute("x", plant.x);
            el.setAttribute("y", plant.y);
            el.setAttribute("fill", "rgb(" + color + ",0,0,0.5)");
            el.setAttribute("width", iconWidth * plants[plant.plant_id].scale + "px");
            el.setAttribute("height", iconWidth * plants[plant.plant_id].scale + "px");
            el.setAttribute("class", "draggable");
        }
        else {
            /* create new image */
            el = document.createElementNS("http://www.w3.org/2000/svg", "image");
            el.setAttribute("x", plant.x);
            el.setAttribute("y", plant.y);
            el.setAttribute("width", iconWidth * plants[plant.plant_id].scale + "px");
            el.setAttribute("height", iconWidth * plants[plant.plant_id].scale + "px");
            el.setAttribute("class", "draggable");
            el.id = plant.id;
            el.setAttribute("href", plants[plant.plant_id].vegetation[selectedMonth]);
            const title = document.createElement("title");
            title.textContent = plants[plant.plant_id].name + ' (' + plants[plant.plant_id].type + ')';
            el.appendChild(title);
        }

        /* plant is selected? */
        if(selectedPlants.includes(plant)) {
            el.classList.add("selected-plant");
        }
        /* append to DOM */
        map.appendChild(el);
        /* store in model */
        plant.el = el;
        el.onclick = (e) => {
            const pt = getSVGCoords(e);
            boxSelectPlants({ x: pt.x, y: pt.y, width: 1, height: 1})
        };
    }
}

function editPlant(plant) {
    editingPlant = plant;
    document.getElementById('edit-name').value = plants[plant.plant_id].name;
    document.getElementById('edit-id').value = plants[plant.plant_id].id;
    document.getElementById('edit-type').value = plants[plant.plant_id].type;
    document.getElementById('edit-scale').value = plants[plant.plant_id].scale;
}

function deletePlant() {
    let last_promise = null;
    selectedPlants.forEach(plant => {
        last_promise = fetch('/garden', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: plant.id })
        });
    });
    last_promise.then(() => {
        loadGarden();
    });
}

function saveEdit() {
    /* nothing selected? */
    if(selectedPlants.length < 0) {
        return;
    }

    const plant = selectedPlants[selectedPlants.length-1];
    const model_plant = plants[plant.plant_id];

    model_plant.name = document.getElementById('edit-name').value;
    model_plant.id = document.getElementById('edit-id').value;
    model_plant.type = document.getElementById('edit-type').value;
    model_plant.scale = parseFloat(document.getElementById('edit-scale').value);

    fetch('/plants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model_plant)
    })
    .then(() => { loadPlants() })
    .then(() => { renderGarden() });
}

function cancelEdit() {
    document.getElementById('edit-form').style.display = 'none';
}

/* change zoom */
function zoom(factor, centerX, centerY) {
    /* use global center if no center was given */
    if(!centerX) {
        centerX = svg.clientWidth/2 + svg.clientLeft;
    }
    if(!centerY) {
        centerY = svg.clientHeight/2 + svg.clientTop;
    }
    const pt = getSVGCoords({ clientX: centerX, clientY: centerY });
    // Update the scale
    const oldScale = transform.scale;
    const newScale = oldScale * factor;
    transform.scale = newScale;

    // Adjust translation to keep point under cursor stationary
    transform.x -= (pt.x * newScale - pt.x * oldScale);
    transform.y -= (pt.y * newScale - pt.y * oldScale);

    // Apply transform
    updateTransform();
}

/* apply pan & zoom */
function updateTransform() {
    map.setAttribute("transform", `translate(${transform.x},${transform.y}) scale(${transform.scale})`);
    saveViewToLocalStorage();
}

/* activate/deactivate height visualization */
function toggleHeightView(active) {
    showMaxHeight = active;
    document.getElementById('heightVisualizationToggle').checked = active;
    renderGarden();
}

/* activate/deactivate rectangular selection mode */
function toggleBoxSelect(active) {
    boxSelectMode = active;
    document.getElementById('boxSelectToggle').checked = active;
}

/* check if rectangle r1 is overlapping with rectangle r2 */
function rectsOverlap(r1, r2) {
    return !(r2.x > r1.x + r1.width ||
             r2.x + r2.width < r1.x ||
             r2.y > r1.y + r1.height ||
             r2.y + r2.height < r1.y);
}

/* select plants according to array of images */
function boxSelectPlants(box) {
    /* deselect all */
    clearSelection();

    let selected = [];
    for (const [id, plant] of Object.entries(garden)) {
        const ix = parseFloat(plant.el.getAttribute("x"));
        const iy = parseFloat(plant.el.getAttribute("y"));
        const iw = parseFloat(plant.el.getAttribute("width"));
        const ih = parseFloat(plant.el.getAttribute("height"));
        const imgBox = { x: ix, y: iy, width: iw, height: ih };
        if (rectsOverlap(box, imgBox) && !selectedPlants.includes(plant)) {
            selected.push(plant);
            /* add class to selected plants */
            plant.el.classList.add("selected-plant");
        }
    }

    if(selected.length > 0) {
        /* append to current selection */
        selectedPlants.push(...selected);

        /* show last selected plant in edit dialog */
        let lastPlant = selectedPlants[selectedPlants.length-1];
        editPlant(lastPlant);
    }
}

/* unselect all selected plants */
function clearSelection() {
    /* do nothing if shift key is pressed */
    if(shiftKeyPressed) {
        return;
    }

    selectedPlants.forEach(plant => plant.el.classList.remove("selected-plant"));
    selectedPlants = [];
    if (selectionRect) {
        selectionRect.remove();
        selectionRect = null;
    }
}


// ---------- Helpers ----------
/* calculate transformed SVG coordinates from event's screen coordinates */
function getSVGCoords(e) {
    const pt = svg.createSVGPoint();
    const svgRect = svg.getBoundingClientRect();

    pt.x = e.clientX - svgRect.left;
    pt.y = e.clientY - svgRect.top;
    return pt.matrixTransform(map.getCTM().inverse());
}

// ---------- UI Handlers ----------
svg.addEventListener("mousedown", (e) => {

    const pt = getSVGCoords(e);

    /* click on image */
    if (e.target.classList.contains("draggable")) {

        /* append target to list of selected plants */
        boxSelectPlants({ x: pt.x, y: pt.y, width: 1, height: 1 });
        dragStart = { x: pt.x, y: pt.y };

        /* Prepare for group dragging */
        selectionDragStartPositions = selectedPlants.map(plant => ({
            el: plant.el,
            x: parseFloat(plant.el.getAttribute("x")),
            y: parseFloat(plant.el.getAttribute("y"))
        }));

    }
    /* start rectangular selection mode */
    else if (boxSelectMode) {
        selectionStart = getSVGCoords(e);

        selectionRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        selectionRect.setAttribute("id", "selection-rect");
        selectionRect.setAttribute("x", selectionStart.x);
        selectionRect.setAttribute("y", selectionStart.y);
        selectionRect.setAttribute("width", 0);
        selectionRect.setAttribute("height", 0);
        selectionRect.setAttribute("fill", "rgba(0, 120, 215, 0.3)");
        selectionRect.setAttribute("stroke", "blue");
        selectionRect.setAttribute("stroke-dasharray", "4");
        selectionRect.setAttribute("pointer-events", "none");

        map.appendChild(selectionRect);
        svg.style.cursor = "crosshair";
    }
    /* pan view */
    else {
        // maybe start panning
        panStart = { x: e.clientX, y: e.clientY };
        svg.style.cursor = "grabbing";
    }
});


svg.addEventListener("mousemove", (e) => {

    const pt = getSVGCoords(e);

    /* move dragged image */
    if (selectionDragStartPositions.length > 0) {
        const dx = pt.x - dragStart.x;
        const dy = pt.y - dragStart.y;

        selectionDragStartPositions.forEach(({ el, x, y }) => {
            el.setAttribute("x", x + dx);
            el.setAttribute("y", y + dy);
        });

    }
    /* pan view */
    else if (panStart) {
        isPanning = true;
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        transform.x += dx;
        transform.y += dy;
        panStart = { x: e.clientX, y: e.clientY };
        updateTransform();
    }
    /* rectangular selection mode */
    else if (boxSelectMode && selectionStart && selectionRect) {
        const x = Math.min(selectionStart.x, pt.x);
        const y = Math.min(selectionStart.y, pt.y);
        const width = Math.abs(pt.x - selectionStart.x);
        const height = Math.abs(pt.y - selectionStart.y);

        selectionRect.setAttribute("x", x);
        selectionRect.setAttribute("y", y);
        selectionRect.setAttribute("width", width);
        selectionRect.setAttribute("height", height);
    }
});

svg.addEventListener("mouseup", (e) => {
    /* dropped a dragged image? */
    if(selectionDragStartPositions.length > 0) {
        selectionDragStartPositions.forEach(({ el }) => {
            const id = el.id;
            if (garden[id]) {
                garden[id].x = parseFloat(el.getAttribute("x"));
                garden[id].y = parseFloat(el.getAttribute("y"));
                const plant_copy = { ...garden[id] };
                delete plant_copy.el;

                fetch('/garden', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(plant_copy)
                });
            }
        });
        clearSelection();
        selectionDragStartPositions = [];
    }
    /* finish rectangular selection? */
    else if(boxSelectMode && selectionRect) {
        const x = parseFloat(selectionRect.getAttribute("x"));
        const y = parseFloat(selectionRect.getAttribute("y"));
        const w = parseFloat(selectionRect.getAttribute("width"));
        const h = parseFloat(selectionRect.getAttribute("height"));

        boxSelectPlants({ x, y, width: w, height: h });

        /* end selection */
        selectionStart = null;
        justSelected = true;
        if (selectionRect) {
            selectionRect.remove();
            selectionRect = null;
        }
        svg.style.cursor = null;
        return;
    }
    /* click anywhere clears selection */
    if (e.target.tagName !== 'image' && !isPanning) {
        clearSelection();
    }
    /* stop panning view */
    isPanning = false;
    panStart = null;
    svg.style.cursor = null;

});

/* selection */
svg.addEventListener("mouseover", (e) => {
  if (e.target.classList.contains("draggable")) {
    e.target.style.outline = "0.5px solid #f0f0f0a0";
  }
});

svg.addEventListener("mouseout", (e) => {
  if (e.target.classList.contains("draggable")) {
    e.target.style.outline = null;
  }
});

svg.addEventListener("wheel", (e) => {
    /* zoom view */
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoom(factor, e.clientX, e.clientY);
});

/* plant drag'n'drop */
svg.addEventListener("dragover", (event) => {
    // prevent default to allow drop
    event.preventDefault();
});

svg.addEventListener("drop", (event) => {
    const pt = getSVGCoords(event);
    const x = pt.x;
    const y = pt.y;
    const id = event.dataTransfer.getData('plant-id');
    if (id && plants[id]) {
        const newPlant = {
            x,
            y,
            plant_id: id,
            id: Date.now()
        };
        fetch('/garden', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPlant)
        }).then(() => loadGarden());
    }
    event.preventDefault();
});

/* detect keypresses */
window.onkeydown = (e) => {
    /* set flag if shift key is pressed */
    if(e.code === "ShiftLeft" || e.code === "ShiftRight" ) {
        shiftKeyPressed = true;
    }
    /* ctrl controls box select mode */
    if(e.code === "ControlLeft" || e.code === "ControlRight") {
        toggleBoxSelect(true);
    }
}

window.onkeyup = (e) => {
    /* clear flag if shift key is released */
    if(e.code === "ShiftLeft" || e.code === "ShiftRight" ) {
        shiftKeyPressed = false;
    }
    /* ctrl controls box select mode */
    else if(e.code === "ControlLeft" || e.code === "ControlRight") {
        toggleBoxSelect(false);
    }
    /* delete current selection */
    else if(e.code === "Delete") {
        deletePlant();
    }
    /* escape everything */
    else if(e.code === "Escape") {
        /* stop panning view */
        isPanning = false;
        panStart = null;
        svg.style.cursor = null;
        /* stop box selection */
        selectionStart = null;
        justSelected = true;
        if (selectionRect) {
            selectionRect.remove();
            selectionRect = null;
        }
        /* stop dragging */
        selectionDragStartPositions = [];

        /* redraw */
        renderGarden();
    }
}

window.onload = () => {
    renderMonth();
    loadPlants()
        .then(loadGarden)
        .then(() => updateTransform());
}
