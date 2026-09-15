"""
Static camera fleet data — only the real connected webcam.
"""
import urllib.parse

def _make_svg(code: str, sector: str) -> str:
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">'
        f'<rect width="1280" height="720" fill="#0b121e"/>'
        f'<radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="0%" stop-color="#142238"/><stop offset="100%" stop-color="#04070d"/></radialGradient>'
        f'<rect width="1280" height="720" fill="url(#v)"/>'
        f'<text x="55" y="65" fill="#4d8eff" font-family="monospace" font-size="16" font-weight="bold">BORDERVISION AI • LIVE FEED</text>'
        f'<text x="55" y="665" fill="#8c909f" font-family="monospace" font-size="14">{code} | {sector.upper()} | OPTICAL STREAM OK</text>'
        f'</svg>'
    )
    return f"data:image/svg+xml;utf8,{urllib.parse.quote(svg)}"

CAMERAS_DATA = [
    {
        "id": "cam-webcam-01",
        "name": "Laptop Webcam",
        "code": "CAM-LIVE-78",
        "sector": "Sector North",
        "type": "webcam",
        "status": "online",
        "hasAlert": False,
        "lat": 34.0528,
        "lng": -118.2415,
        "resolution": "1080p HD",
        "fps": 30,
        "bitrate": "4.8 Mbps",
        "imageUrl": "0",
        "coordinatesString": "LAT: 34.0528 N | LNG: 118.2415 W",
        "locationName": "Local Workstation Camera",
        "ptzSupport": False,
    }
]
