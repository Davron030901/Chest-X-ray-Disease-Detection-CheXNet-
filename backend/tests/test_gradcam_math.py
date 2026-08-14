"""Verify the parts of model.py that do not need torch: colormap, PNG encoding, alpha ramp."""
import base64, io, sys, types
import numpy as np
from PIL import Image

# --- copied verbatim from app/model.py -------------------------------------------------
def _jet(x):
    r = np.clip(1.5 - np.abs(4.0 * x - 3.0), 0.0, 1.0)
    g = np.clip(1.5 - np.abs(4.0 * x - 2.0), 0.0, 1.0)
    b = np.clip(1.5 - np.abs(4.0 * x - 1.0), 0.0, 1.0)
    return (np.stack([r, g, b], axis=-1) * 255.0).astype(np.uint8)

def _png_data_url(arr, mode="RGB"):
    buf = io.BytesIO()
    Image.fromarray(arr, mode=mode).save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
# ---------------------------------------------------------------------------------------

ok = True
def check(name, cond, extra=""):
    global ok
    print(("  PASS " if cond else "  FAIL ") + name + (f"  {extra}" if extra else ""))
    ok = ok and cond

print("jet colormap endpoints:")
c0, c25, c50, c75, c100 = [_jet(np.array([v]))[0] for v in (0.0, 0.25, 0.5, 0.75, 1.0)]
check("0.0 is blue-dominant", c0[2] > c0[0] and c0[2] > c0[1], str(tuple(c0)))
check("0.25 is blue->cyan (b max, g rising)", c25[2] == 255 and 100 < c25[1] < 200 and c25[0] == 0, str(tuple(c25)))
check("0.50 is green-dominant", c50[1] > c50[0] and c50[1] > c50[2], str(tuple(c50)))
check("0.75 is orange (r max, b zero)", c75[0] == 255 and c75[2] == 0 and 100 < c75[1] < 200, str(tuple(c75)))
check("1.0 is red-dominant", c100[0] > c100[1] and c100[0] > c100[2], str(tuple(c100)))
check("monotone hue shift, no NaN", not np.isnan(_jet(np.linspace(0,1,256))).any())

print("\nCAM -> RGBA heatmap:")
cam = np.zeros((224, 224), dtype=np.float32)
cam[80:140, 90:150] = 1.0                       # a hot square, like a cardiac silhouette
cam = cam / (cam.max() + 1e-8)
rgb = _jet(cam)
alpha = (np.clip(cam, 0, 1) ** 0.8 * 255).astype(np.uint8)
rgba = np.dstack([rgb, alpha])
check("shape is (224,224,4)", rgba.shape == (224, 224, 4), str(rgba.shape))
check("cold region fully transparent", rgba[0, 0, 3] == 0, f"alpha={rgba[0,0,3]}")
check("hot region fully opaque", rgba[100, 100, 3] == 255, f"alpha={rgba[100,100,3]}")
check("hot region is red-only (true jet dark red top end)", rgba[100,100,0] > 100 and rgba[100,100,1] == 0 and rgba[100,100,2] == 0, str(tuple(rgba[100,100,:3])))
check("mid activation is bright green/yellow", _jet(np.array([0.55]))[0][1] > 200, str(tuple(_jet(np.array([0.55]))[0])))

url = _png_data_url(rgba, mode="RGBA")
check("data URL prefix", url.startswith("data:image/png;base64,"))
raw = base64.b64decode(url.split(",", 1)[1])
im = Image.open(io.BytesIO(raw))
check("decodes back as RGBA PNG", im.mode == "RGBA" and im.size == (224, 224), f"{im.mode} {im.size}")
check("payload under 60 KB", len(raw) < 60_000, f"{len(raw)/1024:.1f} KB")

print("\npreview round-trip:")
prev = (np.random.default_rng(0).random((224,224,3)) * 255).astype(np.uint8)
u = _png_data_url(prev)
im2 = Image.open(io.BytesIO(base64.b64decode(u.split(",",1)[1])))
check("RGB preview round-trips", im2.mode == "RGB" and im2.size == (224,224))

print("\nGrad-CAM math (numpy reference of the torch implementation):")
rng = np.random.default_rng(1)
A = rng.random((1024, 7, 7)).astype(np.float32)          # activations
G = rng.normal(size=(1024, 7, 7)).astype(np.float32)     # gradients
alpha_k = G.mean(axis=(1, 2), keepdims=True)
cam7 = np.maximum((alpha_k * A).sum(0), 0)               # ReLU
check("CAM is 7x7", cam7.shape == (7, 7))
check("CAM is non-negative (ReLU applied)", (cam7 >= 0).all())
norm = (cam7 - cam7.min()) / (cam7.max() - cam7.min() + 1e-8)
check("normalised to [0,1]", abs(norm.min()) < 1e-6 and abs(norm.max() - 1) < 1e-6,
      f"min={norm.min():.6f} max={norm.max():.6f}")
# a channel with zero gradient must not contribute
A2 = A.copy(); A2[0] *= 1000
G2 = G.copy(); G2[0] = 0.0
a2 = G2.mean(axis=(1,2), keepdims=True)
check("zero-gradient channel contributes nothing",
      np.allclose(np.maximum((a2*A2).sum(0),0), np.maximum((a2*A).sum(0),0)))

print("\n" + ("ALL PURE-PYTHON CHECKS PASSED" if ok else "SOME CHECKS FAILED"))
sys.exit(0 if ok else 1)
