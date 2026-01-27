
/* our SVG with our map container - we just take the first svg we
 * encounter - if you embed another SVG before the map, you need to
 * account for that here */
const svg = document.querySelector("svg");
const map = document.getElementById("viewport");
const plantlist = document.getElementById("plantlist");
const palette = document.getElementById("palette");

/* complete model of garden with plant references to plant palette */
let garden = {};
/* plant palette */
let plants = {};
/* anim frame pending */
let af_pending = false;
/* cached CTM */
let cached_ctm_inverse = null;

const paletteEditForm = new bootstrap.Modal('#plant-edit-form');
let paletteCurrentlyEdited = null;
let paletteShown = false;
let paletteFilter = {
    "search": document.getElementById("palette-filter-search").value,  // current search string for plant palette
    "snails": document.getElementById("palette-filter-snails").value, // snail resistence
    "lifetime": document.getElementById("palette-filter-lifetime").value, // max. lifetime
    "location": document.getElementById("palette-filter-location").value, // location preference
    "soil": document.getElementById("palette-filter-soil").value  // soil preference
};

let viewTransform = null;               // current view (x, y, zoom)
let viewIsPanning = false;              // true if pan is currently in progress
let viewPanStart = null;                // coordinates at pan start
let viewMode = "iconVisMode";           // visualize plant height, not icons
let viewMouse = { x: 0, y: 0};          // remember last SVG coords of mouse

let selectionBoxMode = false;
let selectionJustSelected = false;
let selectionStart = null;
let selectionRect = null;
let selection = [];
let selectionDragStart = null;
let selectionDragStartPositions = [];

let shiftKeyPressed = false;

/* currently selected month view */
let monthSelected = 1
/* construct printable month names */
const monthNames = [];
for(let i=0; i<12; i++) {
    var objDate = new Date();
    objDate.setDate(1);
    objDate.setMonth(i);
    monthNames[i] = objDate.toLocaleString(navigator.language, { month: "long" });
};

/* config */
const viewIconWidth = 5;
const gardenMaxHeight = 200.0;          // max plant height (in cm)


/* ---------------------------------------------------------------------------*/
function paletteLoad() {
    /* load plants */
    return fetch('/plants')
        .then(res => res.json())
        .then(data => {
            data.plantlist.forEach(plant => {
                plants[plant['id']] = plant;
            });
        }).then(() => paletteRender());
}

function paletteRender() {
    /* render plantlist */
    const el = document.getElementById('palette-plantlist');
    el.innerHTML = "";
    var locations = [ "all" ];   // list of location tags for filter
    var soils = [ "all" ];       // list of soil tags for filter
    for (const [id, plant] of Object.entries(plants)) {
        const div = document.createElement('div');
        div.className = 'plants-item';
        div.innerText = plant.trivname;
        div.title = plant.name;
        div.draggable = true;
        div.ondragstart = e => {
            e.dataTransfer.setData('plant-id', plant.id);
        };
        div.ondblclick = (e) => {
            paletteEdit(plant);
        }
        const img = document.createElement('img');
        img.src = plant['vegetation']['icon'][monthSelected];
        img.align = "right";
        img.title = plant.name;
        div.appendChild(img);
        el.appendChild(div);
        plant.el = div;

        locations = locations.concat(plant.location);
        locations = locations.concat(plant.location_ideal);
        soils = soils.concat(plant.soil);
        soils = soils.concat(plant.soil_ideal);
    };
    /* remove duplicates */
    locations_uniq = [...new Set(locations)];
    soils_uniq = [...new Set(soils)];
    /* render palette location filter */
    const l_filter = document.getElementById('palette-filter-location');
    l_filter.innerHTML = "";
    for(var i = 0; i < locations_uniq.length; i++) {
        const option = document.createElement("option");
        option.value = locations_uniq[i];
        if(option.value === "all") {
            option.innerText = "alle";
        }
        else {
            option.innerText = locations_uniq[i];
        }
        l_filter.appendChild(option);
    }
    /* render palette soil filter */
    const s_filter = document.getElementById('palette-filter-soil');
    s_filter.innerHTML = "";
    for(var i = 0; i < soils_uniq.length; i++) {
        const option = document.createElement("option");
        option.value = soils_uniq[i];
        if(option.value === "all") {
            option.innerText = "alle";
        }
        else {
            option.innerText = soils_uniq[i];
        }
        s_filter.appendChild(option);
    }

    /* apply any search term */
    paletteFilterNow();
}

function paletteAdd() {
    const newPlant = {
        name: 'Neu',
        trivname: 'novum',
        id: 'new',
        type: '',
        vegetation: {
            icon: Object.fromEntries([...Array(12)].map((_, i) => [i + 1, '/flower.svg'])),
            height: Object.fromEntries([...Array(12)].map((_, i) => [i + 1, 15]))
        }
    };
    fetch('/plants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPlant)
        }).then(() => paletteLoad());
}

function paletteEdit(plant) {
    document.getElementById('edit-name').value = plant.name;
    document.getElementById('edit-name-trivial').value = plant.trivname;
    document.getElementById('edit-type').value = plant.type;
    document.getElementById('edit-cutting').value = plant.cutting;
    document.getElementById('edit-cutting-time').value = plant.cutting_time;
    document.getElementById('edit-location').value = plant.location;
    document.getElementById('edit-location-ideal').value = plant.location_ideal;
    document.getElementById('edit-soil').value = plant.soil;
    document.getElementById('edit-soil-ideal').value = plant.soil_ideal;
    document.getElementById('edit-watering').value = plant.watering;
    document.getElementById('edit-watering-ideal').value = plant.watering_ideal;
    document.getElementById('edit-nutrition').value = plant.nutrition;
    document.getElementById('edit-nutrition-ideal').value = plant.nutrition_ideal;
    document.getElementById('edit-notes').value = plant.notes;
    document.getElementById('edit-scale').value = plant.scale;
    document.getElementById('edit-bloom-start').value = plant.bloom_start;
    document.getElementById('edit-bloom-end').value = plant.bloom_end;
    document.getElementById('edit-max-lifetime').value = plant.max_lifetime;
    document.getElementById('edit-max-width').value = plant.max_width;
    document.getElementById('edit-min-temperature').value = plant.min_temperature;
    document.getElementById('edit-propagation').value = plant.propagation;
    document.getElementById('edit-snails').value = plant.snails;

    /* build list of monthly settings */
    const vegetation = document.getElementById('edit-vegetation');
    vegetation.innerHTML = "";
    for (let month=1; month <= 12; month++) {
        /* settings for one month */
        const monthly = document.createElement('div');
        monthly.className = 'carousel-item' + (month == 1 ? " active" : "");

        const img = document.createElement('img');
        img.src = plant.vegetation.icon[month];
        img.title = monthNames[month-1];
        img.className = 'img-fluid mx-auto d-block mb-1 w-auto h-80 rounded';
        monthly.appendChild(img);

        const div = document.createElement("div");
        div.className = "row me-3";
        monthly.appendChild(div);

        let label = document.createElement("span");
        label.className = "form-label col-2 my-auto";
        label.textContent = "Höhe:";
        div.appendChild(label);

        const height = document.createElement('input');
        height.className = 'form-control col';
        height.placeholder = "height";
        height.type = "number";
        height.step = 0.01;
        height.value = plant.vegetation.height[month];
        height.title = "height of plant in this month"
        div.appendChild(height);

        label = document.createElement("span");
        label.className = "col-1 my-auto";
        label.textContent = "cm";
        div.appendChild(label);

        const caption = document.createElement('div');
        caption.className = 'text-center fw-bold fs-5 mt-2';
        caption.textContent = monthNames[month-1];
        monthly.appendChild(caption);

        vegetation.appendChild(monthly);
    }

    paletteCurrentlyEdited = plant;
    paletteEditForm.show();
}

function paletteSaveEdit() {
    const plant = {...paletteCurrentlyEdited}

    delete plant.el;
    plant.name = document.getElementById('edit-name').value;
    plant.trivname = document.getElementById('edit-name-trivial').value;
    plant.type = document.getElementById('edit-type').value;
    plant.cutting = document.getElementById('edit-cutting').value;
    plant.cutting_time = document.getElementById('edit-cutting-time').value;
    plant.location = document.getElementById('edit-location').value.split(",");
    plant.location_ideal = document.getElementById('edit-location-ideal').value.split(",");
    plant.soil = document.getElementById('edit-soil').value.split(",");
    plant.soil_ideal = document.getElementById('edit-soil-ideal').value.split(",");
    plant.watering = document.getElementById('edit-watering').value;
    plant.watering_ideal = document.getElementById('edit-watering-ideal').value;
    plant.nutrition = document.getElementById('edit-nutrition').value;
    plant.nutrition_ideal = document.getElementById('edit-nutrition-ideal').value;
    plant.notes = document.getElementById('edit-notes').value;
    plant.scale = parseFloat(document.getElementById('edit-scale').value);
    plant.bloom_start = parseInt(document.getElementById('edit-bloom-start').value);
    plant.bloom_end = parseInt(document.getElementById('edit-bloom-end').value);
    plant.max_lifetime = parseInt(document.getElementById('edit-max-lifetime').value);
    plant.max_width = parseInt(document.getElementById('edit-max-width').value);
    plant.min_temperature = parseInt(document.getElementById('edit-min-temperature').value);
    plant.propagation = document.getElementById('edit-propagation').value.split(",");
    plant.snails = document.getElementById('edit-snails').value;

    fetch('/plants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plant)
    })
    .then(() => {
        paletteCurrentlyEdited = null;
        paletteEditForm.hide();
        paletteLoad().then(() => {
            gardenRender();
        });
    })
}

/* clear search filter */
function paletteFilterSearchClear() {
    document.getElementById("palette-filter-search").value = "";
    paletteFilterChanged("");
}

/* reset other filters */
function paletteFilterReset() {
    document.getElementById("palette-filter-location").value = "all";
    document.getElementById("palette-filter-soil").value = "all";
    document.getElementById("palette-filter-lifetime").value = "all";
    document.getElementById("palette-filter-snails").value = 0;
    paletteFilterChanged();
}

/* filter settings changed */
function paletteFilterChanged() {
    paletteFilter.search = document.getElementById("palette-filter-search").value;
    paletteFilter.lifetime = document.getElementById("palette-filter-lifetime").value;
    paletteFilter.snails = parseInt(document.getElementById("palette-filter-snails").value);
    paletteFilter.location = document.getElementById("palette-filter-location").value;
    paletteFilter.soil = document.getElementById("palette-filter-soil").value;
    switch(paletteFilter.snails) {

        case 2:
            document.getElementById("palette-filter-snails-label").textContent = "resistent";
            break;

        case 1:
            document.getElementById("palette-filter-snails-label").textContent = "wenig";
            break;

        default:
            document.getElementById("palette-filter-snails-label").textContent = "alle";
            break;

    }
    paletteFilterNow();
    viewSaveSettings();
}

/* filter palette list by string */
function paletteFilterNow() {
    const needle = paletteFilter.search.toUpperCase();

    for (const [id, plant] of Object.entries(plants)) {
        /* show by default */
        plant.el.style.display = "";
        /* filter by snail attractiveness */
        if(paletteFilter.snails == 2 && plant.snails != "hardened") {
            /* show only hardened */
            plant.el.style.display = "none";
            continue;
        }
        if(paletteFilter.snails == 1 && plant.snails == "very") {
            /* hide very attractive plants */
            plant.el.style.display = "none";
            continue;
        }
        /* filter by lifetime */
        if(paletteFilter.lifetime == "perennial" && parseInt(plant.max_lifetime) <= 1) {
            /* doesn't match filter */
            plant.el.style.display = "none";
            continue;
        }
        if(paletteFilter.lifetime == "annual" && parseInt(plant.max_lifetime) > 1) {
            /* doesn't match filter */
            plant.el.style.display = "none";
            continue;
        }
        /* filter by location */
        if(paletteFilter.location != "all" && paletteFilter.soil != "" &&
          !plant.location.includes(paletteFilter.location) &&
          !plant.location_ideal.includes(paletteFilter.location) ) {
            plant.el.style.display = "none";
            continue;
        }
        /* filter by soil */
        if(paletteFilter.soil != "all" && paletteFilter.soil != "" &&
           !plant.soil.includes(paletteFilter.soil) &&
           !plant.soil_ideal.includes(paletteFilter.soil) ) {
            plant.el.style.display = "none";
            continue;
        }
        /* filter by text search */
        if(!(
            (plant.name.toUpperCase().indexOf(needle) > -1) ||
            (plant.trivname.toUpperCase().indexOf(needle) > -1) ||
            (plant.notes.toUpperCase().indexOf(needle) > -1)
          )) {
            /* no string matches filter */
            plant.el.style.display = "none";
            continue;
        }
    }
}

function gardenLoad() {
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
        .then(() => { gardenRender(); });
}

function gardenRender() {
    /* remove all images */
    plantlist.innerHTML = "";
    for (const [id, plant] of Object.entries(garden)) {
        /* get the plant model belonging to this plant */
        const plant_model = plants[plant.plant_id];
        /* DOM element for this plant */
        let el = null;

        switch(viewMode) {
            /* draw icons */
            case "iconVisMode":
                /* create new image */
                el = document.createElementNS("http://www.w3.org/2000/svg", "image");
                el.setAttribute("href", plant_model.vegetation.icon[monthSelected]);
                break;

            /* visualize max height */
            case "heightVisMode":
                /* calculate color shade from height */
                const height_color = (255.0 / gardenMaxHeight) * plant_model.vegetation.height[monthSelected];
                el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                el.setAttribute("fill", "rgb(" + height_color + ",0," + (255.0 - height_color) + ",0.5)");
                break;

            /* visualize cut time */
            case "cutVisMode":
                let cut_color = "white";
                if(plant_model.cutting_time == monthSelected) {
                    cut_color = "green";
                } else {
                    cut_color = "red";
                }
                el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                el.setAttribute("fill", cut_color);
                break;

            /* visualize snail resistance */
            case "snailVisMode":
                let snail_color = "white";
                switch(plant_model.snails) {
                    case "very":
                        snail_color = "red";
                        break;

                    case "little":
                        snail_color = "yellow";
                        break;

                    case "hardened":
                        snail_color = "green";
                        break;
                }
                el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                el.setAttribute("fill", snail_color);
                break;
        }

        el.setAttribute("x", plant.x);
        el.setAttribute("y", plant.y);
        el.setAttribute("width", viewIconWidth * plant_model.scale + "px");
        el.setAttribute("height", viewIconWidth * plant_model.scale + "px");
        el.setAttribute("class", "draggable");
        el.id = plant.id;

        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${plant_model.trivname} - ${plant_model.name}\n` +
            `Typ:\t\t\t\t${plant_model.type}\n` +
            `Schnitt:\t\t\t${plant_model.cutting}\n` +
            `Schnittzeit:\t\t${plant_model.cutting_time}\n` +
            `Standort:\t\t\t${plant_model.location}\n` +
            `Standort (ideal):\t${plant_model.location_ideal}\n` +
            `Boden:\t\t\t${plant_model.soil}\n` +
            `Boden (ideal):\t\t${plant_model.soil_ideal}\n` +
            `Wasser:\t\t\t${plant_model.watering}\n` +
            `Wasser (ideal):\t${plant_model.watering_ideal}\n` +
            (plant_model.note ? `\nBeachte:\t\t\t${plant_model.note}\n` : "");
        el.appendChild(title);

        /* plant is selected? */
        if(selection.includes(plant)) {
            el.classList.add("selected-plant");
        }
        /* append to DOM */
        plantlist.appendChild(el);
        /* store in model */
        plant.el = el;

        el.onclick = (e) => {
            /* add to list of selected plants */
            selection.push(plant);
            e.target.classList.add("selected-plant");
        };
    }
}

function gardenDeletePlant() {
    fetch('/garden', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selection)
    }).then(() => {
        selection = [];
        gardenLoad();
    });
}

/* export garden JSON (all attributes from DB) */
function gardenExportJson() {
    fetch('/garden')
        .then(res => {
            if (!res.ok) throw new Error('Failed to fetch garden data');
            return res.json();
        })
        .then(data => {
            const text = JSON.stringify(data, null, 2);
            const element = document.createElement('a');
            element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(text));
            element.setAttribute('download', `garden-all.json`);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        })
        .catch(err => {
            alert('Export failed: ' + err.message);
        });
}

/* trigger import (open file picker) */
function gardenImportTrigger() {
    const input = document.getElementById('importGardenFile');
    if (!input) {
        alert('Import not supported in this environment.');
        return;
    }
    input.value = ''; // clear previous selection
    input.click();
}

/* handle import file selection */
const importGardenInput = document.getElementById('importGardenFile');
if (importGardenInput) {
    importGardenInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        // Optional: client-side size check against common server MAX_CONTENT_LENGTH (1MB)
        const MAX_CLIENT_FILE_SIZE = 40 * 1024 * 1024; // 40 MB
        if (file.size > MAX_CLIENT_FILE_SIZE) {
            const proceed = confirm('Selected file is larger than 40 MB. The server may reject large uploads. Proceed?');
            if (!proceed) {
                importGardenInput.value = '';
                return;
            }
        }

        const reader = new FileReader();
        reader.onload = () => {
            let parsed;
            try {
                parsed = JSON.parse(reader.result);
            } catch (ex) {
                alert('Invalid JSON file: ' + ex.message);
                importGardenInput.value = '';
                return;
            }

            let plantsToPost = null;
            if (Array.isArray(parsed)) {
                // file contains an array of plant objects
                plantsToPost = parsed;
            } else if (parsed && Array.isArray(parsed.plantlist)) {
                // file uses wrapped format { plantlist: [...] }
                plantsToPost = parsed.plantlist;
            } else if (parsed && typeof parsed === 'object' && parsed.id) {
                // single plant object
                plantsToPost = [parsed];
            } else {
                alert('JSON does not appear to contain plant data (expected array or {plantlist: [...] }).');
                importGardenInput.value = '';
                return;
            }

            // POST to /garden to preserve existing behavior (accepts single or list)
            fetch('/garden', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(plantsToPost)
            })
            .then(res => {
                if (!res.ok) {
                    return res.text().then(t => { throw new Error(t || 'Server rejected import'); });
                }
                return res.json();
            })
            .then(() => {
                // reload data and UI
                gardenLoad().then(() => {
                    alert('Import successful');
                });
            })
            .catch(err => {
                alert('Import failed: ' + err.message);
            })
            .finally(() => {
                importGardenInput.value = '';
            });
        };
        reader.readAsText(file);
    });
}

/* export plant species JSON (all attributes from DB) */
function plantExportJson() {
    fetch('/plants')
        .then(res => {
            if (!res.ok) throw new Error('Failed to fetch plant palette');
            return res.json();
        })
        .then(data => {
            const text = JSON.stringify(data, null, 2);
            const element = document.createElement('a');
            element.setAttribute('href', 'data:application/json;charset=utf-8,' + encodeURIComponent(text));
            element.setAttribute('download', `plants-all.json`);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        })
        .catch(err => {
            alert('Export failed: ' + err.message);
        });
}

/* trigger plant import (open file picker) */
function plantImportTrigger() {
    const input = document.getElementById('importPlantsFile');
    if (!input) {
        alert('Import not supported in this environment.');
        return;
    }
    input.value = ''; // clear previous selection
    input.click();
}

/* handle plant import file selection */
const importPlantsInput = document.getElementById('importPlantsFile');
if (importPlantsInput) {
    importPlantsInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const MAX_CLIENT_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
        if (file.size > MAX_CLIENT_FILE_SIZE) {
            const proceed = confirm('Selected file is larger than 1 MB. The server may reject large uploads. Proceed?');
            if (!proceed) {
                importPlantsInput.value = '';
                return;
            }
        }

        const reader = new FileReader();
        reader.onload = () => {
            let parsed;
            try {
                parsed = JSON.parse(reader.result);
            } catch (ex) {
                alert('Invalid JSON file: ' + ex.message);
                importPlantsInput.value = '';
                return;
            }

            let plantsToPost = null;
            if (Array.isArray(parsed)) {
                // file contains an array of plant objects
                plantsToPost = parsed;
            } else if (parsed && Array.isArray(parsed.plantlist)) {
                // file uses wrapped format { plantlist: [...] }
                plantsToPost = parsed.plantlist;
            } else if (parsed && typeof parsed === 'object' && parsed.id) {
                // single plant object
                plantsToPost = [parsed];
            } else {
                alert('JSON does not appear to contain plant species data (expected array or {plantlist: [...] }).');
                importPlantsInput.value = '';
                return;
            }

            // POST to /plants to append species; /plants endpoint accepts list or single object
            fetch('/plants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(plantsToPost)
            })
            .then(res => {
                if (!res.ok) {
                    return res.text().then(t => { throw new Error(t || 'Server rejected import'); });
                }
                return res.json();
            })
            .then(() => {
                // reload palette and garden render (palette used by gardenRender)
                paletteLoad().then(() => {
                    gardenRender();
                    alert('Plant import successful');
                });
            })
            .catch(err => {
                alert('Import failed: ' + err.message);
            })
            .finally(() => {
                importPlantsInput.value = '';
            });
        };
        reader.readAsText(file);
    });
}

/* export SVG */
function gardenExportSvg() {
    /* serialize SVG */
    let xml = new XMLSerializer().serializeToString(svg);
    /* add FQDN to image hrefs */
    xml = xml.replaceAll('href=\"/', `href="${location}`);
    /* append as hidden element to document */
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(xml));
    element.setAttribute('download', `garden-${monthSelected}.svg`);
    element.style.display = 'none';
    document.body.appendChild(element);
    /* emulate click to download */
    element.click();
    /* clean up */
    document.body.removeChild(element);
}

/* change currently displayed month */
function monthUpdateIcons(month) {
    monthSelected = month;
    viewSaveSettings();
    monthRender();
    gardenRender();
    paletteRender();
}

/* display name of currently shown month */
function monthRender() {
    document.getElementById('month').textContent = monthNames[monthSelected-1];
}

/* save current view settings to local browser storage */
function viewSaveSettings() {
    localStorage.setItem("view", JSON.stringify({
        'offsetX': viewTransform.x,
        'offsetY': viewTransform.y,
        'scale': viewTransform.scale,
        'monthSelected': monthSelected,
        'viewMode': viewMode,
        'paletteShown': paletteShown,
        'filter': paletteFilter
    }));
}

/* load settings from local browser storage */
function viewLoadSettings() {
    /* load view from browser localstorage */
    const viewSaved = JSON.parse(localStorage.getItem("view") || '{}');
    viewTransform = {
        x: viewSaved.offsetX || 0,
        y: viewSaved.offsetY || 0,
        scale: viewSaved.scale || 1,
        centerX: undefined,
        centerY: undefined
    };

    paletteShown = viewSaved.paletteShown || false;
    const offcanvas = new bootstrap.Offcanvas(palette);
    paletteShown ? offcanvas.show() : offcanvas.hide();

    monthSelected = viewSaved.monthSelected || 1;
    document.getElementById("monthSlider").value = monthSelected;

    viewMode = viewSaved.viewMode || "iconVisMode";
    viewModeChanged(viewMode);

    paletteFilter = viewSaved.filter || paletteFilter;
    paletteFilterChanged();
}

/* change zoom */
function viewZoom(factor, centerX, centerY) {
    /* use global center if no center was given */
    if(!centerX) {
        centerX = svg.clientWidth/2 + svg.clientLeft;
    }
    if(!centerY) {
        centerY = svg.clientHeight/2 + svg.clientTop;
    }
    const pt = getSVGCoords({ clientX: centerX, clientY: centerY });
    // Update the scale
    const oldScale = viewTransform.scale;
    const newScale = oldScale * factor;
    viewTransform.scale = newScale;

    // Adjust translation to keep point under cursor stationary
    viewTransform.x -= (pt.x * newScale - pt.x * oldScale);
    viewTransform.y -= (pt.y * newScale - pt.y * oldScale);

    // Apply transform
    viewUpdateTransform();
}

/* apply pan & zoom */
function viewUpdateTransform() {
    if(af_pending) return;
    af_pending = true;

    requestAnimationFrame(() => {
        af_pending = false;
        map.setAttribute("transform", `translate(${viewTransform.x},${viewTransform.y}) scale(${viewTransform.scale})`);
        viewSaveSettings();

        // invalidate + refresh cached inverse
        cached_ctm_inverse = map.getCTM().inverse();
    });
}

/* change visualization mode */
function viewModeChanged(mode) {
    /* deselect current mode toggle */
    document.getElementById(viewMode).checked = false;
    /* set new mode */
    viewMode = mode;
    /* update UI */
    document.getElementById(viewMode).checked = true;
    viewSaveSettings();
    gardenRender();
}

/* activate/deactivate rectangular selection mode */
function boxSelectToggle(active) {
    selectionBoxMode = active;
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
function selectionBox(box) {
    /* deselect all */
    selectionClear();

    let selected = [];
    for (const [id, plant] of Object.entries(garden)) {
        const ix = parseFloat(plant.el.getAttribute("x"));
        const iy = parseFloat(plant.el.getAttribute("y"));
        const iw = parseFloat(plant.el.getAttribute("width"));
        const ih = parseFloat(plant.el.getAttribute("height"));
        const imgBox = { x: ix, y: iy, width: iw, height: ih };
        if (rectsOverlap(box, imgBox) && !selection.includes(plant)) {
            selected.push(plant);
            /* add class to selected plants */
            plant.el.classList.add("selected-plant");
        }
    }

    if(selected.length > 0) {
        /* append to current selection */
        selection.push(...selected);
    }
}

/* unselect all selected plants */
function selectionClear() {
    /* do nothing if shift key is pressed */
    if(shiftKeyPressed) {
        return;
    }

    selection.forEach(plant => plant.el.classList.remove("selected-plant"));
    selection = [];
    if (selectionRect) {
        selectionRect.remove();
        selectionRect = null;
    }
}

/* calculate transformed SVG coordinates from event's screen coordinates */
function getSVGCoords(e) {
    const pt = svg.createSVGPoint();
    const svgRect = svg.getBoundingClientRect();

    pt.x = e.clientX - svgRect.left;
    pt.y = e.clientY - svgRect.top;
    return pt.matrixTransform(cached_ctm_inverse);
}

/* generate a random id */
function randomId() {
  return "100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

/* ---------------------------------------------------------------------------*/
viewLoadSettings();

// ---------- UI Handlers ----------
svg.addEventListener("mousedown", (e) => {

    const pt = getSVGCoords(e);

    /* click on image */
    if (e.target.classList.contains("draggable")) {

        /* append target to list of selected plants */
        selectionBox({ x: pt.x, y: pt.y, width: 1, height: 1 });
        selectionDragStart = { x: pt.x, y: pt.y };

        /* Prepare for group dragging */
        selectionDragStartPositions = selection.map(plant => ({
            el: plant.el,
            x: parseFloat(plant.el.getAttribute("x")),
            y: parseFloat(plant.el.getAttribute("y"))
        }));

    }
    /* start rectangular selection mode */
    else if (selectionBoxMode) {
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
        viewPanStart = { x: e.clientX, y: e.clientY };
        svg.style.cursor = "grabbing";
    }
});

svg.addEventListener("mousemove", (e) => {

    const pt = getSVGCoords(e);
    /* remember last mouse position */
    viewMouse.x = pt.x;
    viewMouse.y = pt.y;

    /* move dragged image */
    if (selectionDragStartPositions.length > 0) {
        const dx = pt.x - selectionDragStart.x;
        const dy = pt.y - selectionDragStart.y;

        selectionDragStartPositions.forEach(({ el, x, y }) => {
            el.setAttribute("x", x + dx);
            el.setAttribute("y", y + dy);
        });

    }
    /* pan view */
    else if (viewPanStart) {
        viewIsPanning = true;
        const dx = e.clientX - viewPanStart.x;
        const dy = e.clientY - viewPanStart.y;
        viewTransform.x += dx;
        viewTransform.y += dy;
        viewPanStart = { x: e.clientX, y: e.clientY };
        viewUpdateTransform();
    }
    /* rectangular selection mode */
    else if (selectionBoxMode && selectionStart && selectionRect) {
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
    /* dropped dragged plant(s)? */
    if(selectionDragStartPositions.length > 0) {
        const dragged_plants = [];

        selectionDragStartPositions.forEach(({ el }) => {
            const id = el.id;
            if (garden[id]) {
                garden[id].x = parseFloat(el.getAttribute("x"));
                garden[id].y = parseFloat(el.getAttribute("y"));
                /* remember plants to modify */
                dragged_plants.push({
                    x: garden[id].x,
                    y: garden[id].y,
                    plant_id: garden[id].plant_id,
                    id: id
                });
            }
        });
        fetch('/garden', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dragged_plants)
        }).then(() => {
           //selectionClear();
            selectionDragStartPositions = [];
        });
    }
    /* finish rectangular selection? */
    else if(selectionBoxMode && selectionRect) {
        const x = parseFloat(selectionRect.getAttribute("x"));
        const y = parseFloat(selectionRect.getAttribute("y"));
        const w = parseFloat(selectionRect.getAttribute("width"));
        const h = parseFloat(selectionRect.getAttribute("height"));

        selectionBox({ x, y, width: w, height: h });

        /* end selection */
        selectionStart = null;
        selectionJustSelected = true;
        if (selectionRect) {
            selectionRect.remove();
            selectionRect = null;
        }
        svg.style.cursor = null;
        return;
    }
    /* click anywhere clears selection */
    if (e.target.tagName !== 'image' && !viewIsPanning) {
        selectionClear();
    }
    /* stop panning view */
    viewIsPanning = false;
    viewPanStart = null;
    svg.style.cursor = null;

});

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
    viewZoom(factor, e.clientX, e.clientY);
});

svg.addEventListener("dragover", (e) => {
    // prevent default to allow drop
    e.preventDefault();
});

svg.addEventListener("drop", (e) => {
    const pt = getSVGCoords(e);
    const x = pt.x;
    const y = pt.y;
    const id = e.dataTransfer.getData('plant-id');
    if (id && plants[id]) {
        const newPlant = {
            x,
            y,
            plant_id: id,
            id: randomId()
        };
        fetch('/garden', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPlant)
        }).then(() => gardenLoad());
    }
    e.preventDefault();
});

/* remember current palette state */
palette.addEventListener('shown.bs.offcanvas', event => {
  paletteShown = true;
  viewSaveSettings();
});

palette.addEventListener('hidden.bs.offcanvas', event => {
  paletteShown = false;
  viewSaveSettings();
});

window.onkeydown = (e) => {
    /* don't do anything if text is entered */
    if(document.activeElement.id != "") {
        return true;
    }

    /* set flag if shift key is pressed */
    if(e.code === "ShiftLeft" || e.code === "ShiftRight" ) {
        shiftKeyPressed = true;
    }
    /* ctrl controls box select mode */
    if(e.code === "ControlLeft" || e.code === "ControlRight") {
        boxSelectToggle(true);
    }
}

window.onkeyup = (e) => {
    /* don't do anything if text is entered */
    if(document.activeElement.id != "") {
        return true;
    }
    /* clear flag if shift key is released */
    if(e.code === "ShiftLeft" || e.code === "ShiftRight" ) {
        shiftKeyPressed = false;
    }
    /* ctrl controls box select mode */
    else if(e.code === "ControlLeft" || e.code === "ControlRight") {
        boxSelectToggle(false);
    }
    /* delete current selection */
    else if(e.code === "Delete") {
        gardenDeletePlant();
    }
    /* escape everything */
    else if(e.code === "Escape") {
        /* stop panning view */
        viewIsPanning = false;
        viewPanStart = null;
        svg.style.cursor = null;
        /* stop box selection */
        selectionStart = null;
        selectionJustSelected = true;
        if (selectionRect) {
            selectionRect.remove();
            selectionRect = null;
        }
        /* stop dragging */
        selectionDragStartPositions = [];

        /* redraw */
        gardenRender();
    }
    /* open edit dialog */
    else if(e.code === "KeyE") {
        if(selection.length <= 0) {
            return;
        }

        const plant = selection[selection.length-1];
        paletteEdit(plants[plant.plant_id]);
    }
}

/* copy selection */
document.oncopy = (e) => {
    if(selection.length <= 0) {
        return;
    }

    /* create copy of current selection */
    try {
        copied_plants = JSON.parse(JSON.stringify(selection));
        /* delete el */
        copied_plants.forEach(plant => {
            delete plant.el;
        });
    }
    catch {
        return;
    }

    e.preventDefault();

    /* wait one frame to get transient user activation */
    requestAnimationFrame(() => {
        navigator.clipboard.writeText(JSON.stringify(copied_plants));
    });

}

/* paste selection */
document.onpaste = (e) => {
    let pasted_plants;

    navigator.clipboard.readText().then((text) => {
        if(!text) {
            return;
        }
        /* parse json */
        try {
            pasted_plants = JSON.parse(text);
            /* generate new ID for all pasted plants */
            pasted_plants.forEach(plant => {
                plant.id = randomId();
                delete plant.el;
            });
        }
        catch {
            /* do nothing if parsing fails */
            return;
        }

        /* add pasted plants to garden */
        fetch('/garden', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pasted_plants)
        }).then(() => {
            /* reload & redraw garden */
            gardenLoad().then(() => {

                /* get pasted plants */
                const loaded_plants = [];
                pasted_plants.forEach(plant => {
                    loaded_plants.push(garden[plant.id]);
                });

                /* start dragging newly pasted plants for placement */
                selectionDragStart = { x: loaded_plants[0].x, y: loaded_plants[0].y };
                const dx = viewMouse.x - selectionDragStart.x;
                const dy = viewMouse.y - selectionDragStart.y;

                /* Prepare for group dragging */
                selectionDragStartPositions = loaded_plants.map(plant => ({
                    el: plant.el,
                    x: parseFloat(plant.el.getAttribute("x")),
                    y: parseFloat(plant.el.getAttribute("y"))
                }));

                /* initial move */
                selectionDragStartPositions.forEach(({ el, x, y }) => {
                    el.setAttribute("x", x + dx);
                    el.setAttribute("y", y + dy);
                });

            });
        });
    });

}

window.onload = () => {
    monthRender();
    paletteLoad()
        .then(() => {
            /* load garden plants */
            gardenLoad();
        })
        .then(() => viewUpdateTransform());
}
