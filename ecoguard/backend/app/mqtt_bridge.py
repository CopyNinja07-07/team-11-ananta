"""MQTT link for the room and water nodes (optional; HTTP /api/ingest works without it).

Set MQTT_URL (for example mqtt://localhost:1883) before starting the backend.
Nodes publish one reading every 15 minutes to   ecoguard/<building>/readings
and listen for relay / pump / valve commands on  ecoguard/<building>/commands
"""
from __future__ import annotations

import json
import logging
import os
import threading
from urllib.parse import urlparse

log = logging.getLogger("ecoguard.mqtt")


def start(handle, building: str = "block-a"):
    """handle(reading: dict) -> list[command dict]. Returns the client, or None when MQTT is not configured."""
    url = os.environ.get("MQTT_URL")
    if not url:
        return None
    import paho.mqtt.client as mqtt

    u = urlparse(url)
    topic_in, topic_out = f"ecoguard/{building}/readings", f"ecoguard/{building}/commands"
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"ecoguard-backend-{building}")
    if u.username:
        client.username_pw_set(u.username, u.password)
    lock = threading.Lock()

    def on_connect(c, _userdata, _flags, rc, _props=None):
        log.info("MQTT connected (%s), listening on %s", rc, topic_in)
        c.subscribe(topic_in, qos=1)

    def on_message(c, _userdata, msg):
        try:
            reading = json.loads(msg.payload)
            with lock:                      # one reading at a time, like the HTTP endpoint
                cmds = handle(reading)
            # always answer, so a node knows its reading arrived even when there is nothing to do
            c.publish(topic_out, json.dumps({"ts": reading.get("ts"), "commands": cmds}), qos=1)
        except Exception:                   # a bad message must never stop the bridge
            log.exception("bad MQTT reading")

    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(u.hostname or "localhost", u.port or 1883, keepalive=60)
    client.loop_start()
    return client
