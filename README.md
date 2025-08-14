
# gardenmap

![1754824133527435938](https://github.com/user-attachments/assets/bfb83598-d0c7-4295-b27e-aa205627a263)

I needed a tool for hobby garden planning, to visualize a garden over the year.

This is a **very** simple webapp to do just that.
The backend uses flask (but could be easily adapted to anything as it's just very basic CRUD and data storage in json files).

POC CODE WITHOUT ANY SECURITY CONSIDERATIONS! DON'T RUN THIS ON THE PUBLIC INTERNET!


## Requirements

* python + flask
* bootstrap (included)


## Features

* uses SVG
* pannable with click on map
* zoom with +/- buttons or scrollwheel
* searchable plant palette (🎨 button)
* add plants via drag/drop
* month slider updates visualized vegetation
* visualize plant height over year with gradient blue = small, red = tall (📏 button)
* keyboard shortcuts
  * e to edit selected plant (or doubleclick plant in palette)
  * del to delete selected plant(s) (or click 🗑  button)
  * hold shift to select multiple plants
  * hold ctrl to draw box to select multiple plants (or toggle ⛶ button)
  * escape to cancel current operation
* copy/paste (ctrl+c/ctrl+v)
* no 3rd party dependencies - works without connection to the internet


# Customization

## map background

The SVG map background must be in the form of:

```
<?xml version="1.0" encoding="UTF-8" ?>
<svg id="gardensvg" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">
    <g id="viewport" transform="translate(0) scale(1)">
       <g id="plantlist"></g>
       ...
    </g>
</svg>

```

* the SVG must have the id ```gardensvg```
* all you map contents must reside inside a group with id ```viewport```
* inside the map group, there must be an empty group with id ```plantlist``` where the app adds plants on the map


## plants.json

Defines each plant in the palette.


## garden.json

Contains your garden data (will be created if not existing)


## TODO
- export SVG
- mobile support
