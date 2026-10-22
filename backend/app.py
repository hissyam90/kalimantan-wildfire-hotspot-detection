import os
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, Response, abort, jsonify, request, send_from_directory
from werkzeug.middleware.proxy_fix import ProxyFix

from routes.hotspots import hotspots_bp
from routes.model_status import model_status_bp
from routes.wind import wind_bp

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR.parent / "frontend" / "dist"
UPLOAD_DIR = BASE_DIR / "uploads"
INFER_SCRIPT = BASE_DIR / "python" / "infer.py"

PREDICT_WINDOW_SECONDS = 60
PREDICT_MAX_REQUESTS = 10
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
DEFAULT_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:7860,http://127.0.0.1:7860"
)

load_dotenv(BASE_DIR / ".env")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES
app.json.sort_keys = False
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

ALLOWED_ORIGINS = {
    origin.strip().rstrip("/")
    for origin in (os.environ.get("FRONTEND_ORIGINS") or DEFAULT_ORIGINS).split(",")
    if origin.strip()
}

predict_hits = {}
predict_lock = threading.Lock()


def predict_allowed(address):
    now = time.monotonic()
    with predict_lock:
        recent = [stamp for stamp in predict_hits.get(address, []) if now - stamp < PREDICT_WINDOW_SECONDS]
        if len(recent) >= PREDICT_MAX_REQUESTS:
            predict_hits[address] = recent
            return False
        recent.append(now)
        predict_hits[address] = recent
        return True


def inference_stream(image_path):
    yield f"[{time.strftime('%H:%M:%S')}] Menyiapkan proses Python dan TensorFlow\n"
    try:
        process = subprocess.Popen(
            [os.environ.get("PYTHON_BIN") or sys.executable, str(INFER_SCRIPT), str(image_path)],
            cwd=str(BASE_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
    except OSError as error:
        app.logger.error("Gagal menjalankan infer.py: %s", error)
        try:
            image_path.unlink()
        except OSError:
            pass
        yield "ERROR: Inferensi gambar gagal\n"
        return
    errors = []

    def drain_errors():
        for line in process.stderr:
            errors.append(line.rstrip())

    reader = threading.Thread(target=drain_errors, daemon=True)
    reader.start()
    try:
        while True:
            line = process.stdout.readline()
            if not line:
                break
            text = line.rstrip("\r\n")
            if text.strip():
                yield text + "\n"
        process.wait()
    except GeneratorExit:
        process.kill()
        raise
    finally:
        reader.join(timeout=5)
        if process.poll() is None:
            process.kill()
        try:
            image_path.unlink()
        except OSError:
            pass
        for line in errors:
            if line.strip():
                app.logger.error("infer.py: %s", line)
    if process.returncode != 0:
        yield "ERROR: Inferensi gambar gagal\n"


def frontend_file(name):
    index_path = DIST_DIR / "index.html"
    if not index_path.is_file():
        return jsonify({
            "error": "Frontend belum dibangun",
            "detail": "Jalankan npm run build di folder frontend, atau pakai npm run dev di port 5173.",
        }), 503
    candidate = DIST_DIR / name
    if candidate.is_file() and ".." not in Path(name).parts:
        return send_from_directory(DIST_DIR, name)
    return send_from_directory(DIST_DIR, "index.html")


@app.after_request
def apply_cors(response):
    origin = (request.headers.get("Origin") or "").rstrip("/")
    if origin and origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = (
            request.headers.get("Access-Control-Request-Headers") or "Content-Type"
        )
        response.headers["Access-Control-Max-Age"] = "600"
        response.headers.add("Vary", "Origin")
    return response


@app.errorhandler(413)
def upload_too_large(error):
    return jsonify({"error": "Upload gambar tidak valid", "code": "LIMIT_FILE_SIZE"}), 413


@app.errorhandler(404)
def not_found(error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Endpoint tidak ditemukan"}), 404
    return frontend_file("index.html")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "wildfire-backend"})


@app.post("/api/predict")
def predict():
    if not predict_allowed(request.remote_addr or "unknown"):
        return jsonify({"error": "Terlalu banyak permintaan, coba lagi sebentar lagi"}), 429
    upload = request.files.get("image")
    if upload is None or not upload.filename:
        return jsonify({"error": "Tidak ada gambar yang diupload"}), 400
    suffix = Path(upload.filename).suffix.lower() or ".jpg"
    target = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"
    upload.save(target)
    response = Response(inference_stream(target), content_type="text/plain; charset=utf-8")
    response.headers["Cache-Control"] = "no-cache"
    response.headers["X-Accel-Buffering"] = "no"
    return response


@app.get("/")
def index():
    return frontend_file("index.html")


@app.get("/<path:name>")
def static_asset(name):
    if name.startswith("api/"):
        abort(404)
    return frontend_file(name)


app.register_blueprint(hotspots_bp)
app.register_blueprint(wind_bp)
app.register_blueprint(model_status_bp)


if __name__ == "__main__":
    host = os.environ.get("HOST") or "127.0.0.1"
    port = int(os.environ.get("PORT") or 7860)
    print(f"Server jalan di http://{host}:{port}")
    app.run(host=host, port=port, threaded=True, debug=False, use_reloader=False)
