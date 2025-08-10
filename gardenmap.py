#!/usr/bin/env python

import fcntl
from flask import Flask, render_template, request, jsonify
import json
import os

app = Flask(__name__, static_url_path='')

PALETTE_FILE = 'plants.json'
DATA_FILE = 'garden.json'
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump({"plantlist": []}, f)

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/plants', methods=['GET', 'POST', 'PUT'])
def plants():
    match request.method:

        case 'POST':
            new_plant = request.json
            with open(PALETTE_FILE, 'r+') as f:
                # Acquire exclusive lock on the file
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)

                data = json.load(f)
                # append list of plants?
                if(isinstance(new_plant, list)):
                    data["plantlist"] += new_plant
                else:
                    data["plantlist"] += [ new_plant ]
                f.seek(0)
                json.dump(data, f, indent=2)
                f.truncate()
                # Release the lock
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            return jsonify({'status': 'success'})

        case 'PUT':
            updated_plant = request.json
            with open(PALETTE_FILE, 'r+') as f:
                # Acquire exclusive lock on the file
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)

                data = json.load(f)
                for i, plant in enumerate(data["plantlist"]):
                    if plant['id'] == updated_plant['id']:
                        data["plantlist"][i] = updated_plant
                        break
                f.seek(0)
                json.dump(data, f, indent=2)
                f.truncate()
                # Release the lock
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)

            return jsonify({'status': 'updated'})

        case _:
            with open(PALETTE_FILE) as f:
                data = json.load(f)
            return jsonify(data)

@app.route('/garden', methods=['GET', 'POST', 'PUT', 'DELETE'])
def garden():

    match request.method:
        case 'POST':
            new_plant = request.json
            with open(DATA_FILE, 'r+') as f:
                # Acquire exclusive lock on the file
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)

                data = json.load(f)
                # append list of plants?
                if(isinstance(new_plant, list)):
                    data["plantlist"] += new_plant
                else:
                    data["plantlist"] += [ new_plant ]
                f.seek(0)
                json.dump(data, f, indent=2)
                f.truncate()
                # Release the lock
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)

            return jsonify({'status': 'success'})

        case 'PUT':
            updated_plant = request.json
            with open(DATA_FILE, 'r+') as f:
                # Acquire exclusive lock on the file
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)

                data = json.load(f)
                for i, plant in enumerate(data["plantlist"]):
                    if plant['id'] == updated_plant['id']:
                        data["plantlist"][i] = updated_plant
                        break
                f.seek(0)
                json.dump(data, f, indent=2)
                f.truncate()
                # Release the lock
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)

            return jsonify({'status': 'updated'})

        case 'DELETE':
            # got single or multiple plants to delete?
            if(isinstance(request.json, list)):
                deleted_ids = [ p['id'] for p in request.json ]
            else:
                deleted_ids = request.json['id']

            with open(DATA_FILE, 'r+') as f:
                # Acquire exclusive lock on the file
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)

                data = json.load(f)
                # create new plantlist without deleted ones
                data["plantlist"] = [ p for p in data['plantlist'] if p['id'] not in deleted_ids ]

                f.seek(0)
                json.dump(data, f, indent=2)
                f.truncate()
                # Release the lock
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)

            return jsonify({'status': 'deleted'})

        case _:
            with open(DATA_FILE) as f:
                data = json.load(f)
            return jsonify(data)


if __name__ == '__main__':
    app.run(debug=True)
