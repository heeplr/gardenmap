"""used for WSGI server: --mount /=gardenmap.wsgi:app"""

import gardenmap


def app(*args, **kwargs):
    """main flask app factory"""
    return gardenmap.app
