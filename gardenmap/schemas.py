
from marshmallow import EXCLUDE, fields, Schema


class VegetationSchema(Schema):
    """
    vegetation: {
      "height": { "1": num, ..., "12": num },
      "icon": { "1": "/path.svg", ..., "12": "/path.svg" }
    }
    """
    # plant total height (cm) per month
    height = fields.Dict(keys=fields.String(), values=fields.Float(), allow_none=True)
    # path to svg icon per month
    icon = fields.Dict(keys=fields.String(), values=fields.String(), allow_none=True)

    class Meta:
        unknown = EXCLUDE


class PlantSchema(Schema):
    """
    Schema derived from gardenmap/plants.json.
    Unknown fields are excluded (not preserved).
    """
    id = fields.String(required=True)
    # botanical name
    name = fields.String(allow_none=True)
    # trivial name
    trivname = fields.String(allow_none=True)
    # type of gardenplant
    type = fields.String(allow_none=True)
    # month when bloom starts
    bloom_start = fields.Integer(allow_none=True)
    # month when bloom ends
    bloom_end = fields.Integer(allow_none=True)
    # cutting notes
    cutting = fields.String(allow_none=True)
    # first month for cutting
    cutting_time = fields.Integer(allow_none=True)
    # max. expected lifespan (years)
    max_lifetime = fields.Integer(allow_none=True)
    # max. width of mature plant (-1 = spreading)
    max_width = fields.Integer(allow_none=True)
    # min. temperature that can be survived
    min_temperature = fields.Integer(allow_none=True)
    # location preferences
    location = fields.List(fields.String(), allow_none=True)
    # ideal location preferences
    location_ideal = fields.List(fields.String(), allow_none=True)
    # nutrition preferences
    nutrition = fields.String(allow_none=True)
    # ideal nutrition preferences
    nutrition_ideal = fields.String(allow_none=True)
    # soil preferences
    soil = fields.List(fields.String(), allow_none=True)
    # ideal soil preferences
    soil_ideal = fields.List(fields.String(), allow_none=True)
    # watering preferences
    watering = fields.String(allow_none=True)
    # ideal watering preferences
    watering_ideal = fields.String(allow_none=True)
    # snail resistance
    snails = fields.String(allow_none=True)
    # means of propagation
    propagation = fields.List(fields.String(), allow_none=True)
    # icon scale factor
    scale = fields.Float(allow_none=True)
    # plant heights/icon per month
    vegetation = fields.Nested(VegetationSchema, allow_none=True)
    # ...
    notes = fields.String(allow_none=True)

    class Meta:
        # Do not preserve unknown fields
        unknown = EXCLUDE


class GardenItemSchema(Schema):
    """
    Schema for one placed plant in the garden

      - id: integer or string (often numeric or generated hex id) - required for updates/deletes
      - plant_id: string referencing palette entry (required for creation)
      - x, y: floats for position (required)
    """
    id = fields.Raw(required=True)
    plant_id = fields.String(required=True)
    x = fields.Float(required=True)
    y = fields.Float(required=True)

    class Meta:
        unknown = EXCLUDE
