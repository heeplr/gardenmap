let plants = {};
let selectedMonth = 1;
let editingPlant = null;

const transform = { x: 0, y: 0, scale: 1 };
let isPanning = false;
let panStart = { x: 0, y: 0 };

let draggingImage = null;
let dragStart = { x: 0, y: 0 };
let imageStart = { x: 0, y: 0 };


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

const palette = [
    { name: 'Tomato', type: 'Vegetable', vegetation: Object.fromEntries([...Array(12)].map((_, i) => [i + 1, 'https://media.lordicon.com/icons/wired/lineal/1704-flower-doodle.svg'])) },
    { name: 'Carrot', type: 'Root', vegetation: Object.fromEntries([...Array(12)].map((_, i) => [i + 1, 'https://media.lordicon.com/icons/wired/lineal/1704-flower-doodle.svg'])) }
];

function togglePalette() {
    const el = document.getElementById('palette');
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
    if (el.style.display === 'block') renderPalette();
}

function renderPalette() {
    const el = document.getElementById('palette');
    el.innerHTML = '';
    palette.forEach((plant, index) => {
        const div = document.createElement('div');
        div.className = 'palette-item';
        div.innerText = plant.name;
        div.draggable = true;
        div.ondragstart = e => {
            e.dataTransfer.setData('plant-index', index);
        };
        el.appendChild(div);
    });
}

function updateIconsByMonth(month) {
    selectedMonth = month;
    saveViewToLocalStorage();
    updatePlants();
}

function loadPlants() {
    /* remove all plants */
    document.querySelectorAll('#gardensvg image').forEach(e => e.remove());

    /* load plants */
    fetch('/plants')
        .then(res => res.json())
        .then(data => {
            /* initialize each plant icon */
            plants = {};
            data.plants.forEach(plant => {
                /* store model */
                plants[plant.id] = plant;
            });
            /* redraw */
            updatePlants();
        });
}

function updatePlants() {
    for (const [id, plant] of Object.entries(plants)) {
        /* remove current image */
        if(plant.img) {
            plant.img.remove();
        }
        /* create new image */
        const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
        img.setAttribute("x", plant.x);
        img.setAttribute("y", plant.y);
        img.setAttribute("width", 50);
        img.setAttribute("height", 50);
        img.setAttribute("class", "draggable");
        //img.onclick = () => editPlant(plant);
        img.id = plant.id;
        img.setAttribute("href", plant.vegetation[selectedMonth]);
        img.setAttribute("title", plant.name + ' (' + plant.type + ')');
        /* append to DOM */
        map.appendChild(img);
        /* store image */
        plant.img = img;
    }
}

function editPlant(plant) {
    editingPlant = plant;
    document.getElementById('edit-name').value = plant.name;
    document.getElementById('edit-type').value = plant.type;
    document.getElementById('edit-form').style.display = 'block';
}

function saveEdit() {
    editingPlant.name = document.getElementById('edit-name').value;
    editingPlant.type = document.getElementById('edit-type').value;
    let plant_copy = { ...editingPlant };
    delete plant_copy['img'];

    fetch('/plants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plant_copy)
    }).then(() => {
        document.getElementById('edit-form').style.display = 'none';
        loadPlants();
    });
}

function cancelEdit() {
    document.getElementById('edit-form').style.display = 'none';
}

// ---------- Helpers ----------
function getSVGCoords(e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(map.getCTM().inverse());
}

// ---------- Panning ----------
map.addEventListener("mousedown", (e) => {
  if (e.target.classList.contains("draggable")) {
    // Start dragging image
    draggingImage = e.target;
    const pt = getSVGCoords(e);
    dragStart = { x: pt.x, y: pt.y };
    imageStart = {
      x: parseFloat(draggingImage.getAttribute("x")),
      y: parseFloat(draggingImage.getAttribute("y"))
    };
  } else {
    // Start panning
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    map.style.cursor = "grabbing";
  }
});

map.addEventListener("mousemove", (e) => {
  if (draggingImage) {
    const pt = getSVGCoords(e);
    const dx = pt.x - dragStart.x;
    const dy = pt.y - dragStart.y;
    draggingImage.setAttribute("x", imageStart.x + dx);
    draggingImage.setAttribute("y", imageStart.y + dy);
  } else if (isPanning) {
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    transform.x += dx;
    transform.y += dy;
    panStart = { x: e.clientX, y: e.clientY };
    updateTransform();
  }
});

map.addEventListener("mouseup", () => {
    /* dropped a dragged plant? */
    if(draggingImage) {
        const plant = plants[draggingImage.id]
        plant.x = draggingImage.getAttribute("x");
        plant.y = draggingImage.getAttribute("y");
        let plant_copy = { ...plant };
        delete plant_copy['img'];

        fetch('/plants', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plant_copy)
        });
    }

    isPanning = false;
    draggingImage = null;
    map.style.cursor = null;
});

map.addEventListener("mouseleave", () => {
  isPanning = false;
  draggingImage = null;
});

// ---------- Zoom ----------
function zoom(factor) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const pt = getSVGCoords({ clientX: cx, clientY: cy });
  transform.scale *= factor;
  transform.x = cx - pt.x * transform.scale;
  transform.y = cy - pt.y * transform.scale;
  updateTransform();
}

function updateTransform() {
  viewport.setAttribute("transform", `translate(${transform.x},${transform.y}) scale(${transform.scale})`);
  saveViewToLocalStorage();
}

map.addEventListener("wheel", (e) => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  const pt = getSVGCoords(e);
  transform.scale *= factor;
  transform.x = e.clientX - pt.x * transform.scale;
  transform.y = e.clientY - pt.y * transform.scale;
  updateTransform();
});

svg.addEventListener("dragover", (event) => {
  // prevent default to allow drop
  event.preventDefault();
});
svg.addEventListener("drop", (event) => {
    const rect = svg.getBoundingClientRect();
    const x = (event.clientX - rect.left - transform.x) / transform.scale;
    const y = (event.clientY - rect.top - transform.y) / transform.scale;
    const index = event.dataTransfer.getData('plant-index');
    if (index) {
        const base = palette[index];
        const newPlant = { ...base, x, y, id: Date.now() };
        fetch('/plants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPlant)
        }).then(() => loadPlants());
    }
    event.preventDefault();
});

window.onload = () => {
    loadPlants();
    updateTransform();
}
