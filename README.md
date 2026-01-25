
# gardenmap

![1754824133527435938](https://github.com/user-attachments/assets/bfb83598-d0c7-4295-b27e-aa205627a263)

Simple browser based app for garden visualizing/planning. 

**Disclaimer:**
```
All botanical data & plant images were created by AI and only roughly validated, yet.
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


## Features

* pan map with click + drag
* zoom with **+**/**-** buttons or scrollwheel
* visualize
  * ...plant appearance for every month (🌸)
  * ...plant height over year with gradient blue = small, red = tall (📏)
  * ...cutting time for every month (✂️)
  * ...snail resistance (🐌)
* plant summary shown in tooltip when hovering over icon on map
* searchable plant palette (🎨)
* add plants from palette via drag/drop
* add new plants to palette (**+**)
* no 3rd party dependencies - works without connection to the internet
* export map view as SVG
* import/export plant palette
* import/export garden data
* copy/paste plants (<kbd>Ctrl</kbd>+<kbd>c</kbd> / <kbd>ctrl</kbd>+<kbd>v</kbd>)
* keyboard shortcuts
  * <kbd>e</kbd> to edit selected plant (or doubleclick plant in palette)
  * <kbd>Del</kbd> to delete selected plant(s) (or 🗑))
  * hold <kbd>Shift</kbd> to select multiple plants
  * hold <kbd>Ctrl</kbd> to draw box to select multiple plants (or toggle ⛶)
  * <kbd>Esc</kbd> to cancel current operation


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
