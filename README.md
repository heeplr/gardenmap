
# gardenmap

![1754824133527435938](https://github.com/user-attachments/assets/bfb83598-d0c7-4295-b27e-aa205627a263)

Simple browser based app for garden visualizing/planning. 

## Usage

Run the app and point your browser to http://127.0.0.1:5000


## Requirements

* python
 * flask
 * flask-smorest
 * filelock
 * sqlite (optional)


## Features

* pan map with click + drag
* zoom with +/- buttons or scrollwheel
* visualize
  * ...plant appearance for every month 🌸
  * ...plant height over year with gradient blue = small, red = tall 📏
  * ...cutting time for every month ✂️
  * ...snail resistance 🐌
* plant summary shown in tooltip when hovering over icon on map
* searchable plant palette 🎨
* add plants from palette via drag/drop
* add new plants to palette +
* keyboard shortcuts
  * e to edit selected plant (or doubleclick plant in palette)
  * del to delete selected plant(s) (or click 🗑)
  * hold shift to select multiple plants
  * hold ctrl to draw box to select multiple plants (or toggle ⛶)
  * escape to cancel current operation
* copy/paste (ctrl+c/ctrl+v)
* no 3rd party dependencies - works without connection to the internet
* export map view as SVG
* import/export plant palette
* import/export garden data


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
