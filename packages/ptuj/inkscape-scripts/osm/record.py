"""Records the app itself, close up over the old town, as the README's
animated picture: the spinning wireframe models of the places (Kavarna
Evropa's glitching into a skull), the traffic and the trains.

    python3 record.py ../../dist ../../preview.gif

It needs a development build in dist (yarn b:ptuj, which bundles three
and React, so nothing is fetched from the network), Firefox and ffmpeg.
Firefox runs headless and is driven over Marionette, its built in remote
protocol. The page gets a clock of its own, stepped a frame at a time
while recording, so the animation is smooth however slowly the headless
browser draws.

Map data © OpenStreetMap contributors, ODbL.
"""
import base64
import functools
import http.server
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time

WIDTH, HEIGHT = 1280, 720  # the browser's window
FPS = 25  # frames a second, of the page's clock and of the picture
SECONDS = 8  # as long as one skull glitch of the banned places' icons
SCALE = 800  # the width of the picture
GIF_FPS = 12.5  # half the frames, to keep the GIF small
# put before the app: process, which the build (for node) leaves in
# React and three, and the page's own clock, which the recording steps by hand
CLOCK = """<script>
window.process = { env: { NODE_ENV: "production" }, emitWarning() {} };
(() => {
    const real = performance.now.bind(performance);
    const raf = window.requestAnimationFrame.bind(window);
    const start = Date.now();
    let now = 0;
    let manual = false;
    let next = 1;
    let queue = new Map();
    performance.now = () => now;
    Date.now = () => start + now;
    window.requestAnimationFrame = (callback) => {
        queue.set(next, callback);
        return next++;
    };
    window.cancelAnimationFrame = (id) => queue.delete(id);
    const step = (ms) => {
        now += ms;
        const callbacks = queue;
        queue = new Map();
        for (const callback of callbacks.values()) {
            callback(now);
        }
    };
    let last = real();
    const tick = () => {
        if (!manual) {
            const time = real();
            step(Math.min(time - last, 100));
            last = time;
            raf(tick);
        }
    };
    raf(tick);
    window.__clock = {
        hold: () => (manual = true),
        step,
    };
})();
</script>
"""


class Marionette:
    """A little client of Firefox's Marionette protocol: length prefixed
    JSON, [0, id, command, parameters] out and [1, id, error, result]
    back."""

    def __init__(self, port):
        for _ in range(300):
            try:
                self.socket = socket.create_connection(("127.0.0.1", port))
                break
            except OSError:
                time.sleep(0.1)
        else:
            raise RuntimeError("Firefox did not open Marionette")
        self.id = 0
        self.read()  # the greeting

    def read(self):
        size = b""
        while not size.endswith(b":"):
            size += self.socket.recv(1)
        data = b""
        while len(data) < int(size[:-1]):
            data += self.socket.recv(int(size[:-1]) - len(data))
        return json.loads(data)

    def __call__(self, command, **parameters):
        self.id += 1
        message = json.dumps([0, self.id, command, parameters]).encode()
        self.socket.sendall(str(len(message)).encode() + b":" + message)
        while True:
            _, id, error, result = self.read()
            if id == self.id:
                if error:
                    raise RuntimeError(f"{command}: {error}")
                return result

    def run(self, script, *args):
        return self(
            "WebDriver:ExecuteScript", script=script, args=list(args))["value"]

    def pointer(self, *steps):
        self("WebDriver:PerformActions", actions=[{
            "type": "pointer", "id": "mouse",
            "parameters": {"pointerType": "mouse"}, "actions": list(steps)}])
        self("WebDriver:ReleaseActions")


def serve(directory):
    """Serves the build, with record.html: its index.html with the clock
    put before the app."""
    page = open(os.path.join(directory, "index.html")).read()
    page = page.replace("<head>", "<head>\n" + CLOCK, 1).encode()

    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path != "/record.html":
                return super().do_GET()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(page)))
            self.end_headers()
            self.wfile.write(page)

        def log_message(self, *args):
            pass

    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(Handler, directory=directory))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main(directory, target):
    if not os.path.exists(os.path.join(directory, "index.js")):
        sys.exit(f"no build in {directory}: run yarn b:ptuj first")
    server = serve(directory)
    work = tempfile.mkdtemp(prefix="ptuj-record-")
    port = free_port()
    with open(os.path.join(work, "user.js"), "w") as prefs:
        for name, value in {
            "marionette.port": port,
            "browser.shell.checkDefaultBrowser": False,
            "datareporting.policy.dataSubmissionEnabled": False,
            "toolkit.telemetry.reportingpolicy.firstRun": False,
            "browser.aboutwelcome.enabled": False,
            "webgl.force-enabled": True,
        }.items():
            prefs.write(f"user_pref({json.dumps(name)}, "
                        f"{json.dumps(value)});\n")
    firefox = subprocess.Popen(
        ["firefox", "--headless", "--marionette", "--no-remote",
         "--profile", work, f"--window-size={WIDTH},{HEIGHT}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        record(Marionette(port), server.server_address[1], work, target)
    finally:
        firefox.terminate()
        firefox.wait()
        server.shutdown()
        shutil.rmtree(work, ignore_errors=True)


def record(browser, port, work, target):
    browser("WebDriver:NewSession", capabilities={})
    # the window, so the page inside its frame is WIDTH by HEIGHT
    browser("WebDriver:SetWindowRect", width=WIDTH, height=HEIGHT)
    dx, dy = browser.run("return [outerWidth - innerWidth,"
                         " outerHeight - innerHeight]")
    browser("WebDriver:SetWindowRect", width=WIDTH + dx, height=HEIGHT + dy)
    browser("WebDriver:Navigate", url=f"http://127.0.0.1:{port}/record.html")

    def wait(script, what, seconds=60):
        for _ in range(seconds * 10):
            if browser.run(script):
                return
            time.sleep(0.1)
        raise RuntimeError(f"timed out waiting for {what}")

    wait("return !!document.querySelector('canvas')", "the map")
    error = browser.run(
        "const m = document.querySelector('.message');"
        "return m && m.textContent")
    if error:
        raise RuntimeError(error)
    time.sleep(3)  # the first frames, while the clock still runs by itself

    # the credits closed, then from the overview to the old town: a click
    # on the name of the centre turns there, double clicks on it come
    # nearer, a third of the way each
    browser.run("[...document.querySelectorAll('button')]"
                ".find((b) => b.textContent.trim() === 'OK')?.click()")
    click = [{"type": "pointerDown", "button": 0},
             {"type": "pointerUp", "button": 0}]
    for clicks in (click, click * 2, click * 2):
        x, y = browser.run(
            "const l = [...document.querySelectorAll('.label.quarter')]"
            ".find((l) => l.textContent === 'Center');"
            "const r = l.getBoundingClientRect();"
            "return [Math.round(r.left + r.width / 2), Math.round(r.bottom)];")
        browser.pointer({"type": "pointerMove", "x": x, "y": y + 4}, *clicks)
        time.sleep(5)
    # the pointer out of the way, so no place card is open
    browser.pointer({"type": "pointerMove", "x": 0, "y": HEIGHT - 1})
    time.sleep(1)

    # then hold the clock and draw the frames one by one
    browser.run("window.__clock.hold()")
    frames = os.path.join(work, "frames")
    os.makedirs(frames)
    for frame in range(SECONDS * FPS):
        browser.run("window.__clock.step(arguments[0])", 1000 / FPS)
        png = browser("WebDriver:TakeScreenshot")["value"]
        with open(os.path.join(frames, f"{frame:04d}.png"), "wb") as file:
            file.write(base64.b64decode(png))
        print(f"\rframe {frame + 1}/{SECONDS * FPS}", end="", flush=True)
    print()

    # one palette for the whole loop keeps the GIF from flickering, and
    # only the changed rectangle of each frame keeps it small
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(FPS),
         "-i", os.path.join(frames, "%04d.png"), "-vf",
         f"fps={GIF_FPS},scale={SCALE}:-1:flags=lanczos,split[a][b];"
         "[a]palettegen=max_colors=64:stats_mode=diff[p];"
         "[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
         "-loop", "0", target],
        check=True)


if __name__ == "__main__":
    main(*sys.argv[1:])
