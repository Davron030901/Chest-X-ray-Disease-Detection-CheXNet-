"""
End-to-end test of the FastAPI routing/validation/schema layer.

torch cannot be installed in this sandbox (the PyTorch CDN is proxy-blocked and the PyPI
CUDA wheel exceeds the disk), so torch/torchvision are stubbed and the inference call is
replaced with a deterministic fake. Everything that is NOT torch math is exercised for real:
routes, query params, upload validation, error envelope, pydantic response models, CORS.
"""
import io, json, sys, types
import numpy as np
from PIL import Image

# ---- minimal torch / torchvision stubs -------------------------------------------------
torch = types.ModuleType("torch")
torch.set_num_threads = lambda n: None
torch.set_grad_enabled = lambda b: None
torch.enable_grad = lambda: types.SimpleNamespace(__enter__=lambda s: None, __exit__=lambda s,*a: False)
torch.inference_mode = lambda: types.SimpleNamespace(__enter__=lambda s: None, __exit__=lambda s,*a: False)
torch.load = lambda *a, **k: {}
torch.sigmoid = lambda x: x
nn = types.ModuleType("torch.nn"); nn.Module = object; nn.Linear = lambda *a, **k: object()
F = types.ModuleType("torch.nn.functional"); F.relu = lambda x: x; F.interpolate = lambda *a, **k: x
torch.nn = nn; torch.Tensor = object
sys.modules["torch"] = torch
sys.modules["torch.nn"] = nn
sys.modules["torch.nn.functional"] = F
tv = types.ModuleType("torchvision")
tvm = types.ModuleType("torchvision.models"); tvm.densenet121 = lambda **k: None
tvt = types.ModuleType("torchvision.transforms")
tvt.Compose = lambda x: x; tvt.Resize = lambda *a: None; tvt.CenterCrop = lambda *a: None
tvt.ToTensor = lambda: None; tvt.Normalize = lambda *a: None
tv.models = tvm; tv.transforms = tvt
sys.modules["torchvision"] = tv
sys.modules["torchvision.models"] = tvm
sys.modules["torchvision.transforms"] = tvt

from fastapi.testclient import TestClient
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app import main as app_main
from app.model import _jet, _png_data_url

CLASSES = app_main.service.classes
rng = np.random.default_rng(7)
FAKE_PROBS = np.array([0.81,0.44,0.62,0.30,0.12,0.09,0.07,0.22,0.18,0.55,0.05,0.04,0.11,0.01], dtype=np.float32)

class FakeService:
    loaded = True
    classes = CLASSES
    img_size = 224
    arch = "densenet121"
    model_version = "densenet121-nih-sample-v1-TEST"
    thresholds = {c: 0.35 for c in CLASSES}
    metrics = {"mean_auc": 0.742, "train_images": 3924, "val_images": 561, "test_images": 1121,
               "test_patients": 187,
               "per_class": {c: {"auc": 0.70 + i * 0.01, "support": 5 + i * 11} for i, c in enumerate(CLASSES)}}
    def threshold_for(self, label): return self.thresholds.get(label, 0.5)
    def stats_for(self, label):
        pc = self.metrics["per_class"].get(label, {}); return pc.get("auc"), pc.get("support")
    def preprocess(self, raw):
        img = Image.open(io.BytesIO(raw)); img.verify()
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        return object(), np.asarray(img.resize((224, 224)), dtype=np.uint8), img.size
    def predict(self, tensor): return FAKE_PROBS
    def heatmap_png(self, tensor, idx):
        cam = np.zeros((224,224), np.float32); cam[60:150, 70:160] = 1.0
        rgba = np.dstack([_jet(cam), (cam**0.8*255).astype(np.uint8)])
        return _png_data_url(rgba, mode="RGBA")

app_main.service = FakeService()
client = TestClient(app_main.app)

def png_bytes(w=512, h=512):
    buf = io.BytesIO()
    Image.fromarray((rng.random((h, w)) * 255).astype(np.uint8), mode="L").convert("RGB").save(buf, "PNG")
    return buf.getvalue()

ok = True
def check(name, cond, extra=""):
    global ok
    print(("  PASS " if cond else "  FAIL ") + name + (f"   {extra}" if extra else ""))
    ok = ok and cond

print("GET /health")
r = client.get("/health"); j = r.json()
check("200", r.status_code == 200)
check("model_loaded true", j["model_loaded"] is True)
check("reports version + uptime", "model_version" in j and isinstance(j["uptime_s"], (int, float)), j["model_version"])

print("\nGET /meta")
r = client.get("/meta"); j = r.json()
check("200", r.status_code == 200)
check("14 classes", len(j["classes"]) == 14, str(len(j["classes"])))
check("per_class carries threshold/auc/support/paper_auc",
      all(k in j["per_class"][0] for k in ("threshold","auc","support","paper_auc")))
check("paper mean AUC 0.8414", abs(j["paper_mean_auc"] - 0.8414) < 1e-9, str(j["paper_mean_auc"]))
check("paper AUC for Cardiomegaly is 0.9248",
      [c for c in j["per_class"] if c["label"]=="Cardiomegaly"][0]["paper_auc"] == 0.9248)
check("disclaimer present", "not a medical device" in j["disclaimer"].lower())

print("\nPOST /predict (cam=false)")
r = client.post("/predict", files={"file": ("x.png", png_bytes(), "image/png")})
j = r.json()
check("200", r.status_code == 200, r.text[:120])
check("all 14 classes returned", len(j["predictions"]) == 14, str(len(j["predictions"])))
probs = [p["probability"] for p in j["predictions"]]
check("sorted descending", probs == sorted(probs, reverse=True), str([round(p,2) for p in probs[:4]]))
check("rank starts at 1 and is contiguous", [p["rank"] for p in j["predictions"]] == list(range(1,15)))
check("top prediction is Atelectasis @0.81", j["predictions"][0]["label"]=="Atelectasis" and abs(j["predictions"][0]["probability"]-0.81)<1e-3)
check("positive flag matches threshold 0.35",
      all(p["positive"] == (p["probability"] >= p["threshold"]) for p in j["predictions"]))
check("no heatmaps when cam=false", j["heatmaps"] == {})
check("input_preview is a png data URL", j["input_preview"].startswith("data:image/png;base64,"))
check("disclaimer in every response", "not a medical device" in j["disclaimer"].lower())
check("inference_ms is an int", isinstance(j["inference_ms"], int))

print("\nPOST /predict?cam=true&top_k=3")
r = client.post("/predict?cam=true&top_k=3", files={"file": ("x.png", png_bytes(), "image/png")})
j = r.json()
check("200", r.status_code == 200)
check("top_k has 3 labels", len(j["top_k"]) == 3, str(j["top_k"]))
check("one heatmap per top_k label", set(j["heatmaps"]) == set(j["top_k"]))
hm = j["heatmaps"][j["top_k"][0]]
im = Image.open(io.BytesIO(__import__("base64").b64decode(hm.split(",",1)[1])))
check("heatmap is 224x224 RGBA", im.size == (224,224) and im.mode == "RGBA", f"{im.mode} {im.size}")

print("\nvalidation and error envelope")
r = client.post("/predict", files={"file": ("a.pdf", b"%PDF-1.4 junk", "application/pdf")})
check("415 for wrong content type", r.status_code == 415, str(r.status_code))
check("error envelope shape", set(r.json()) == {"error"} and set(r.json()["error"]) == {"code","message"}, json.dumps(r.json())[:90])
check("code is unsupported_type", r.json()["error"]["code"] == "unsupported_type")

r = client.post("/predict", files={"file": ("e.png", b"", "image/png")})
check("400 for empty file", r.status_code == 400 and r.json()["error"]["code"] == "empty_file", str(r.status_code))

r = client.post("/predict", files={"file": ("big.png", b"\x89PNG" + b"0"*(11*1024*1024), "image/png")})
check("413 for >10 MB", r.status_code == 413 and r.json()["error"]["code"] == "file_too_large", str(r.status_code))

r = client.post("/predict", files={"file": ("bad.png", b"not really a png", "image/png")})
check("400 for undecodable image", r.status_code == 400 and r.json()["error"]["code"] == "invalid_image", str(r.status_code))

r = client.post("/predict?top_k=99", files={"file": ("x.png", png_bytes(), "image/png")})
check("422 for top_k out of range", r.status_code == 422, str(r.status_code))

print("\nCORS")
r = client.options("/predict", headers={"Origin": "https://my-app.vercel.app",
                                        "Access-Control-Request-Method": "POST"})
check("preflight allows a vercel.app origin", r.headers.get("access-control-allow-origin") == "https://my-app.vercel.app",
      str(r.headers.get("access-control-allow-origin")))
r = client.options("/predict", headers={"Origin": "http://localhost:3000",
                                        "Access-Control-Request-Method": "POST"})
check("preflight allows localhost:3000", r.headers.get("access-control-allow-origin") == "http://localhost:3000",
      str(r.headers.get("access-control-allow-origin")))
r = client.options("/predict", headers={"Origin": "https://evil.example.com",
                                        "Access-Control-Request-Method": "POST"})
check("preflight rejects an unknown origin", r.headers.get("access-control-allow-origin") is None,
      str(r.headers.get("access-control-allow-origin")))

print("\ndegraded state (model not loaded)")
class Down(FakeService): loaded = False
app_main.service = Down()
check("/health reports degraded", client.get("/health").json()["status"] == "degraded")
check("/meta 503", client.get("/meta").status_code == 503)
r = client.post("/predict", files={"file": ("x.png", png_bytes(), "image/png")})
check("/predict 503 with model_not_loaded", r.status_code == 503 and r.json()["error"]["code"] == "model_not_loaded")

print("\n" + ("ALL API CHECKS PASSED" if ok else "SOME CHECKS FAILED"))
sys.exit(0 if ok else 1)
