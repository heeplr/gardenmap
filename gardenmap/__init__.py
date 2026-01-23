#!/usr/bin/env python

import os
from flask import Flask, render_template, request, jsonify
from flask_smorest import Api, Blueprint
from marshmallow import validate, ValidationError
import pathlib
from typing import Any, Iterable, List


from .schemas import GardenItemSchema, PlantSchema, VegetationSchema
from .storage import StorageError


# current working directory
cwd = pathlib.Path(__file__).parent.resolve()

# storage backend
STORAGE_BACKEND = os.getenv("GARDENMAP_STORAGE", "json").lower()
# json storage settings
JSON_PALETTE_PATH = os.getenv("GARDENMAP_PALETTE_PATH", str(cwd / "plants.json"))
JSON_DATA_PATH = os.getenv("GARDENMAP_DATA_PATH", str(cwd / "garden.json"))
# sqlite storage settings
SQLITE_DB_PATH = os.getenv("GARDENMAP_DB_PATH", str(cwd / "gardenmap.db"))

# initialize storage backend
match STORAGE_BACKEND:

    case "json":
        from .storage.json import JSONFileStorage
        palette_storage = JSONFileStorage(JSON_PALETTE_PATH)
        garden_storage = JSONFileStorage(JSON_DATA_PATH)

    case "sqlite":
        from .storage.sqlite import SQLiteStorage
        palette_storage = SQLiteStorage(SQLITE_DB_PATH, table="palette")
        garden_storage = SQLiteStorage(SQLITE_DB_PATH, table="garden")

    case _:
        raise ArgumentError(f"invalid value \"{STORAGE_BACKEND}\" for STORAGE_BACKEND")


# initialize flask
app = Flask(__name__, static_url_path='')

# minimal OpenAPI / flask-smorest configuration required by the library
app.config.update(
    {
        "API_TITLE": "gardenmap API",
        "API_VERSION": "v1",
        "OPENAPI_VERSION": "3.0.2",
        # Where the OpenAPI spec is served from (root is fine)
        "OPENAPI_URL_PREFIX": "/",
        # Swagger UI setup (served by flask-smorest if desired)
        "OPENAPI_SWAGGER_UI_PATH": "/swagger-ui",
        "OPENAPI_SWAGGER_UI_URL": "https://cdn.jsdelivr.net/npm/swagger-ui-dist/",
        # limit request size (MB)
        "MAX_CONTENT_LENGTH": 40 * 1024 * 1024
    }
)

# create API
api = Api(app)
# keep endpoints at same paths as before by registering a blueprint without a prefix
blp = Blueprint("gardenmap", "gardenmap")

def _get_json_request():
    """Safely retrieve JSON body with size limits and validation."""
    data = request.get_json(silent=True)
    if data is None:
        return None, (jsonify({"error": "invalid or missing JSON body"}), 400)
    return data, None

@blp.route('/')
def index():
    return render_template("index.html")

@blp.route('/plants', methods=['GET', 'POST', 'PUT'])
def plants():
    global palette_storage

    match request.method:
        case 'POST':
            raw, err = _get_json_request()
            if err:
                return err

            schema = PlantSchema(many=isinstance(raw, list))
            try:
                items = schema.load(raw)
            except ValidationError as e:
                return jsonify({"error": "validation_failed", "details": e.messages}), 422

            try:
                palette_storage.append(items)
            except Timeout:
                return jsonify({'error': 'resource busy, try again later'}), 503
            except StorageError:
                return jsonify({'error': 'failed to write data'}), 500

            return jsonify({'status': 'success'})

        case 'PUT':
            raw, err = _get_json_request()
            if err:
                return err

            try:
                updated = PlantSchema().load(raw)
            except ValidationError as e:
                return jsonify({"error": "validation_failed", "details": e.messages}), 422

            try:
                palette_storage.update_one(updated)
            except Timeout:
                return jsonify({'error': 'resource busy, try again later'}), 503
            except StorageError:
                return jsonify({'error': 'failed to write data'}), 500

            return jsonify({'status': 'updated'})

        case _:
            try:
                data = palette_storage.get_wrapped()
                return jsonify(data)
            except Timeout:
                return jsonify({'error': 'resource busy, try again later'}), 503
            except StorageError:
                return jsonify({'error': 'failed to read data'}), 500


@blp.route('/garden', methods=['GET', 'POST', 'PUT', 'DELETE'])
def garden():
    global garden_storage

    match request.method:
        case 'POST':
            raw, err = _get_json_request()
            if err:
                return err

            many = isinstance(raw, list)
            schema = GardenItemSchema(many=many)
            try:
                items = schema.load(raw)
            except ValidationError as e:
                return jsonify({"error": "validation_failed", "details": e.messages}), 422

            # Ensure plant_id present for creations (some clients may include id only; mimic old behavior)
            if many:
                missing = [p for p in items if not p.get('plant_id')]
                if missing:
                    return jsonify({"error": "validation_failed", "details": "plant_id required for new garden items"}), 422
            else:
                if not items.get('plant_id'):
                    return jsonify({"error": "validation_failed", "details": "plant_id required for new garden item"}), 422

            try:
                # ensure we pass iterable of dicts
                if not many:
                    garden_storage.append([items])
                else:
                    garden_storage.append(items)
            except StorageError:
                return jsonify({'error': 'failed to write data'}), 500

            return jsonify({'status': 'success'})

        case 'PUT':
            # update one or more placed plants. Client typically sends [{id,x,y}, ...]
            raw, err = _get_json_request()
            if err:
                return err

            if not isinstance(raw, list):
                raw_items = [raw]
            else:
                raw_items = raw

            # For update semantics we require id present on each item
            try:
                validated: List[dict] = GardenItemSchema(many=True).load(raw_items)
            except ValidationError as e:
                return jsonify({"error": "validation_failed", "details": e.messages}), 422

            try:
                # Use storage-specific batch update (merging semantics preserved)
                if hasattr(garden_storage, "update_many"):
                    garden_storage.update_many(validated)
                else:
                    for p in validated:
                        garden_storage.update_one(p)
            except StorageError:
                return jsonify({'error': 'failed to write data'}), 500

            return jsonify({'status': 'updated'})

        case 'DELETE':
            payload, err = _get_json_request()
            if err:
                return err

            deleted_ids = []
            if isinstance(payload, list):
                # list may be a list of ids or list of objects with id
                if all(not isinstance(x, dict) for x in payload):
                    # assume list of primitive ids
                    deleted_ids = payload
                else:
                    try:
                        items = GardenItemSchema(many=True).load(payload)
                    except ValidationError as e:
                        return jsonify({"error": "validation_failed", "details": e.messages}), 422
                    deleted_ids = [p['id'] for p in items]
            elif isinstance(payload, dict):
                try:
                    item = GardenItemSchema().load(payload)
                except ValidationError as e:
                    return jsonify({"error": "validation_failed", "details": e.messages}), 422
                deleted_ids = [item['id']]
            elif isinstance(payload, (str, int)):
                deleted_ids = [payload]
            else:
                return jsonify({'error': 'invalid delete payload'}), 400

            try:
                garden_storage.delete_by_ids(deleted_ids)
            except StorageError:
                return jsonify({'error': 'failed to write data'}), 500

            return jsonify({'status': 'deleted'})

        case _:
            try:
                data = garden_storage.get_wrapped()
                return jsonify(data)
            except StorageError:
                return jsonify({'error': 'failed to read data'}), 500



api.register_blueprint(blp)


def main():
    debug_flag = os.getenv("FLASK_DEBUG", "0") == "1"
    host = os.getenv("GARDENMAP_HOST", "127.0.0.1")
    try:
        app.run(host=host, debug=debug_flag)
    except Exception:
        raise


if __name__ == '__main__':
    main()
