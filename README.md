
# gardenmap

<img src="https://github.com/user-attachments/assets/c23c2341-b7ea-4a0c-b5e7-3eb7c06fb21e"></img>
<img src="https://github.com/user-attachments/assets/62719856-18d7-4a0b-b891-4ebdf32490bc" width="50%"></img><img src="https://github.com/user-attachments/assets/f0fd81be-5213-473b-9ed0-28344d0eae40" width="50%"></img> 
<img src="https://github.com/user-attachments/assets/63916c11-2875-4e2c-bbdb-b7dd5966bcf3" width="50%"></img><img src="https://github.com/user-attachments/assets/de2eda93-138e-49b6-9d6b-9281a362e9f8" width="50%"></img> 

Simple browser based app for garden visualizing/planning. 

## Features

You can...
* pan the map with click & drag
* zoom the map with **+**/**-** buttons or scrollwheel
* drag plants from the palette and drop them onto the map to place them.
* search/filter the plant palette (🎨)
* adjust the month slider to watch plant phenotype over the year.
* move selected plants (hold <kbd>Shift</kbd> to drag multiple plants)
* use copy/paste (<kbd>Ctrl</kbd>+<kbd>c</kbd> / <kbd>ctrl</kbd>+<kbd>v</kbd>) to create flower beds.
* switch view modes to illustrate plant attributes:
  * Appearance for every month (🌸)
  * Height over year with gradient blue = small, red = tall (📏)
  * Cutting time for every month (✂️)
  * Snail resistance (🐌)
* Hover mouse over plants to show brief details.
* add new plants to palette (**+**)
* no 3rd party dependencies - works without connection to the internet
* export map view as SVG
* import/export plant palette
* import/export garden data
* keyboard shortcuts
  * <kbd>e</kbd> to edit selected plant (or doubleclick plant in palette)
  * <kbd>Del</kbd> to delete selected plant(s) (or 🗑)
  * hold <kbd>Shift</kbd> to select multiple plants
  * hold <kbd>Ctrl</kbd> to draw box to select multiple plants (or toggle ⛶)
  * <kbd>Esc</kbd> to cancel current operation


**Disclaimer:**
```
All botanical data & plant images were created using AI and only roughly reviewed, yet.
```

## Install with pip

1. clone repository

```console
git clone https://github.com/heeplr/gardenmap
```

2. create venv (optional)

```console
$ cd gardenmap
$ python -m venv venv
$ source ./venv/bin/activate
(venv) $ gardenmap
```

3. install dependencies with pip

```console
$ pip install -e .
```


## Usage

Run server:

```console
(venv) $ gardenmap
```

Point your browser to http://127.0.0.1:5000



## Requirements

* python
 * flask
 * flask-smorest
 * filelock
 * sqlite (optional)



# Customization

## map background

The SVG map background must be in the form of:

```
<svg xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">
    <g id="viewport" transform="translate(0) scale(1)">
       <g id="plantlist"></g>
       ...
    </g>
</svg>

```

1. create an SVG of your garden using your favourite editor (e.g. https://www.inkscape.org )
2. create a group with `id="viewport"` and `transform="translate(0) scale(1)"`
 * `<g id="viewport" transform="translate(0) scale(1)">`
3. move all your elements into that group
4. create another group with `id="plantlist"`, leave it empty
5. copy to `gardenmap/templates/map.svg`

## plants.json

Contains plant palette.
Copy missing plant icon images to `gardenmap/static` and edit plants.json


## garden.json

Contains your garden data (will be created if not existing)


# Environment variables

* **GARDENMAP_STORAGE** : set to `sqlite` to use sqlite instead of json for storage
* **JSON_PALETTE_PATH** : path to `plants.json`
* **JSON_DATA_PATH** : path to `garden.json`
* **SQLITE_DB_PATH** : path to sqlite db file


# TODO
- choose plant image/easy upload of plant images
- mobile/touch support?
- better UI/more bootstrap
