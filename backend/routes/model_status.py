import os
from pathlib import Path

from flask import Blueprint, jsonify

model_status_bp = Blueprint("model_status", __name__)

BASE_DIR = Path(__file__).resolve().parent.parent


@model_status_bp.get("/api/model-status")
def model_status():
    configured = os.environ.get("RGB_MODEL_PATH") or "model/wildfire_model.h5"
    candidate = Path(configured)
    if not candidate.is_absolute():
        candidate = BASE_DIR / candidate
    available = candidate.is_file()
    return jsonify({
        "model": "wildfire_rgb_cnn",
        "ready": available,
        "artifactAvailable": available,
        "inferenceEnabled": available,
        "input": "RGB 224x224",
        "status": "ready" if available else "not_trained",
        "message": (
            "CNN RGB aktif pada endpoint /api/predict."
            if available
            else "File model CNN RGB belum tersedia; endpoint prediksi tidak dapat berjalan."
        ),
    })
