`test_api.py` exercises routing, upload validation, the error envelope, response schemas and CORS.

torch and torchvision are stubbed and inference is faked, so the suite runs in seconds with no
model weights and no GPU. It verifies everything except the tensor math itself — that is covered
by the notebook, which trains and evaluates the real network.

```bash
pip install pytest httpx pillow numpy fastapi
python tests/test_api.py        # prints PASS/FAIL per check
```
