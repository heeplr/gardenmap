#!/usr/bin/env python

from flask import Flask, render_template, request, jsonify
import json
import os

app = Flask(__name__, static_url_path='')

PALETTE_FILE = 'palette.json'
DATA_FILE = 'plants.json'
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump({"plants": []}, f)

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/palette', methods=['GET', 'POST', 'PUT'])
def palette():
    match request.method:

        case 'POST':
            new_plant = request.json
            with open(PALETTE_FILE, 'r+') as f:
                data = json.load(f)
                data["palette"] += [ new_plant ]
                f.seek(0)
                json.dump(data, f, indent=2)
                f.truncate()
            return jsonify({'status': 'success'})

        case 'PUT':
            updated_plant = request.json
            with open(PALETTE_FILE, 'r+') as f:
                data = json.load(f)
                for i, plant in enumerate(data["palette"]):
                    if plant['id'] == updated_plant['id']:
                        data["palette"][i] = updated_plant
                        break
                f.seek(0)
                json.dump(data, f, indent=2)
                f.truncate()
            return jsonify({'status': 'updated'})

        case _:
            with open(PALETTE_FILE) as f:
                data = json.load(f)
            return jsonify(data)

@app.route('/plants', methods=['GET', 'POST', 'PUT'])
def plants():
    if request.method == 'POST':
        new_plant = request.json
        with open(DATA_FILE, 'r+') as f:
            data = json.load(f)
            data["plants"].append(new_plant)
            f.seek(0)
            json.dump(data, f, indent=2)
            f.truncate()
        return jsonify({'status': 'success'})
    elif request.method == 'PUT':
        updated_plant = request.json
        with open(DATA_FILE, 'r+') as f:
            data = json.load(f)
            for i, plant in enumerate(data["plants"]):
                if plant['id'] == updated_plant['id']:
                    data["plants"][i] = updated_plant
                    break
            f.seek(0)
            json.dump(data, f, indent=2)
            f.truncate()
        return jsonify({'status': 'updated'})
    else:
        with open(DATA_FILE) as f:
            data = json.load(f)
        return jsonify(data)


if __name__ == '__main__':
    app.run(debug=True)
