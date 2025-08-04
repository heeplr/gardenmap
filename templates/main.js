let garden = {};
let plants = [];
let selectedMonth = 1;
let editingPlant = null;

const transform = { x: 0, y: 0, scale: 1, centerX: undefined, centerY: undefined };
let isPanning = false;
let panStart = { x: 0, y: 0 };

let dragStart = null;
let selectionDragStartPositions = [];

let shiftKeyPressed = false;

let boxSelectMode = false;
let justSelected = false;
let selectionStart = null;
let selectionRect = null;
let selectedPlants = [];

const savedView = JSON.parse(localStorage.getItem("view") || '{}');
transform.x = savedView.offsetX || 0;
transform.y = savedView.offsetY || 0;
transform.scale = savedView.scale || 1;
selectedMonth = savedView.selectedMonth || 1;

const svg = document.getElementById("gardensvg");
const map = document.getElementById("viewport");

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
    fetch('/plants')
        .then(res => res.json())
        .then(data => {
            plants = data.plantlist;
        }).then(() => renderPlants());
}

function renderPlants() {
    const el = document.getElementById('plantlist');
    el.innerHTML = '';
    plants.forEach((plant, index) => {
        const div = document.createElement('div');
        div.className = 'plants-item';
        div.innerText = plant.name;
        div.draggable = true;
        div.ondragstart = e => {
            e.dataTransfer.setData('plant-index', index);
        };
        el.appendChild(div);
    });
}

function togglePlants() {
    const el = document.getElementById('plants');
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
    if (el.style.display === 'block') renderPlants();
}


function plantsNewPlant() {
    const newPlant = {
        name: 'Neu',
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
    updateGarden();
}

function loadGarden() {
    /* remove all plants */
    document.querySelectorAll('#gardensvg image').forEach(e => e.remove());

    /* load garden */
    fetch('/garden')
        .then(res => res.json())
        .then(data => {
            /* initialize each plant icon */
            garden = {};
            data.plantlist.forEach(plant => {
                /* store model */
                garden[plant.id] = plant;
            });
            /* redraw */
            updateGarden();
        });
}

function updateGarden() {
    for (const [id, plant] of Object.entries(garden)) {
        /* remove current image */
        if(plant.img) {
            plant.img.remove();
        }
        /* create new image */
        const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
        img.setAttribute("x", plant.x);
        img.setAttribute("y", plant.y);
        img.setAttribute("width", "5px");
        img.setAttribute("height", "5px");
        img.setAttribute("class", "draggable");
        img.onclick = (e) => {
            const pt = getSVGCoords(e);
            boxSelectPlants({ x: pt.x, y: pt.y, width: 1, height: 1})
        };
        img.id = plant.id;
        img.setAttribute("href", plant.vegetation[selectedMonth]);
        const title = document.createElement("title");
        title.textContent = plant.name + ' (' + plant.type + ')';
        img.appendChild(title);
        /* append to DOM */
        map.appendChild(img);
        /* store image */
        plant.img = img;
    }
}

function editPlant(plant) {
    /* did we fire wrongly after drag operation? */
    if(droppedImage) {
        /* clear flag */
        droppedImage = null;
        /* don't show edit dialog */
        return;
    }
    editingPlant = plant;
    document.getElementById('edit-name').value = plant.name;
    document.getElementById('edit-type').value = plant.type;
    document.getElementById('edit-form').style.display = 'block';
}

function deletePlant() {
    fetch('/garden', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingPlant.id })
    }).then(() => {
        document.getElementById('edit-form').style.display = 'none';
        loadGarden();
    });
}

function saveEdit() {
    editingPlant.name = document.getElementById('edit-name').value;
    editingPlant.type = document.getElementById('edit-type').value;
    let plant_copy = { ...editingPlant };
    delete plant_copy['img'];

    fetch('/garden', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plant_copy)
    }).then(() => {
        document.getElementById('edit-form').style.display = 'none';
        loadGarden();
    });
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

/* activate/deactivate rectangular selection mode */
function toggleBoxSelect() {
    boxSelectMode = !boxSelectMode;
    document.getElementById('boxSelectToggle').style.background = boxSelectMode ? '#cef' : '';
    if (!boxSelectMode) {
        clearSelection();
    }
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


    let selected = Array.from(svg.querySelectorAll('image')).filter(img => {
        const ix = parseFloat(img.getAttribute("x"));
        const iy = parseFloat(img.getAttribute("y"));
        const iw = parseFloat(img.getAttribute("width"));
        const ih = parseFloat(img.getAttribute("height"));
        const imgBox = { x: ix, y: iy, width: iw, height: ih };
        return rectsOverlap(box, imgBox);
    });

    /* append to current selection */
    selectedPlants.push(...selected);

    /* add class to selected plants */
    selectedPlants.forEach(p => p.classList.add("selected-plant"));
}

/* unselect all selected plants */
function clearSelection() {
    /* do nothing if shift key is pressed */
    if(shiftKeyPressed) {
        return;
    }

    selectedPlants.forEach(p => p.classList.remove("selected-plant"));
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

    /* start dragging image */
    if (e.target.classList.contains("draggable")) {

        /* append target to list of selected plants */
        boxSelectPlants({ x: pt.x, y: pt.y, width: 1, height: 1 });
        dragStart = { x: pt.x, y: pt.y };

        /* Prepare for group dragging */
        selectionDragStartPositions = selectedPlants.map(img => ({
            img,
            x: parseFloat(img.getAttribute("x")),
            y: parseFloat(img.getAttribute("y"))
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
        // Start panning
        isPanning = true;
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

        selectionDragStartPositions.forEach(({ img, x, y }) => {
            img.setAttribute("x", x + dx);
            img.setAttribute("y", y + dy);
        });

    }
    /* pan view */
    else if (isPanning) {
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
        selectionDragStartPositions.forEach(({ img }) => {
            const id = img.id;
            if (garden[id]) {
                garden[id].x = parseFloat(img.getAttribute("x"));
                garden[id].y = parseFloat(img.getAttribute("y"));
                const plant_copy = { ...garden[id] };
                delete plant_copy.img;

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
    }
    /* stop panning view */
    isPanning = false;
    svg.style.cursor = null;

});

/* selection */
svg.addEventListener("mouseover", (e) => {
  if (e.target.classList.contains("draggable")) {
    e.target.style.outline = "1px solid black";
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
    const index = event.dataTransfer.getData('plant-index');
    if (index) {
        const base = plants[index];
        const newPlant = { ...base, x, y, id: Date.now() };
        fetch('/garden', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPlant)
        }).then(() => loadGarden());
    }
    event.preventDefault();
});

/* deselect on click outside */
svg.addEventListener("click", (e) => {
    if (e.target.tagName !== 'image' && !justSelected) {
        clearSelection();
    }

    justSelected = false;
});

/* detect keypresses */
window.onkeydown = (e) => {
    /* set flag if shift key is pressed */
    shiftKeyPressed = !e.shiftKey;
    /* ctrl controls box select mode */
    if(!e.ctrlKey) {
        toggleBoxSelect();
    }
}

window.onkeyup = (e) => {
    /* clear flag if shift key is released */
    shiftKeyPressed = !e.shiftKey;
    /* ctrl controls box select mode */
    if(e.ctrlKey) {
        toggleBoxSelect();
    }
}

window.onload = () => {
    loadPlants();
    loadGarden();
    updateTransform();
}
