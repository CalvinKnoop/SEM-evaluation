"""Create deterministic, clearly synthetic SEM-style demonstration images. Requires numpy, Pillow."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'images'
OUT.mkdir(exist_ok=True)
SIZE = 640
SETUPS = [
    ('calibration_01', 9, 23, 42, 0.00, 0.038, 4101),
    ('calibration_02', 15, 20, 42, 0.50, 0.057, 4102),
    ('calibration_03', 24, 15, 38, 0.80, 0.082, 4103),
    ('demo_sem_01', 19, 17, 40, 0.52, 0.055, 5101),
    ('demo_sem_02', 29, 14, 35, 0.85, 0.078, 5102),
    ('demo_sem_03', 13, 24, 50, 0.35, 0.05, 5103),
]
truth = {}
for name, count, rmin, rmax, overlap, noise, seed in SETUPS:
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[:SIZE, :SIZE]
    field = np.full((SIZE, SIZE), .105, dtype=np.float32)
    visible_labels = np.zeros((SIZE, SIZE), dtype=np.uint16)
    particles = []
    for k in range(count):
        for _ in range(500):
            r = float(rng.uniform(rmin, rmax))
            if particles and rng.random() < overlap:
                anchor = particles[int(rng.integers(0, len(particles)))]
                angle = rng.uniform(0, 2*np.pi)
                dist = (anchor['radius_px'] + r) * rng.uniform(.55, 1.04)
                cx = anchor['center_x_px'] + dist * np.cos(angle)
                cy = anchor['center_y_px'] + dist * np.sin(angle)
            else:
                cx = rng.uniform(r+7, SIZE-r-7)
                cy = rng.uniform(r+7, SIZE-r-7)
            if cx-r < 4 or cy-r < 4 or cx+r >= SIZE-4 or cy+r >= SIZE-4:
                continue
            if overlap < .01 and any((cx-p['center_x_px'])**2+(cy-p['center_y_px'])**2 < (r+p['radius_px']+4)**2 for p in particles):
                continue
            break
        else:
            continue
        dx, dy = (xx-cx)/r, (yy-cy)/r
        rho2 = dx*dx + dy*dy
        disk = rho2 <= 1
        z = np.sqrt(np.maximum(0,1-rho2))
        albedo = rng.uniform(.85,1.12)
        shading = np.clip((.34 + .58*(.29*(-dx)+.38*(-dy)+.81*z))*albedo, .1, .98)
        # Dark halo to hint particle edges without encoding label IDs.
        ring = (rho2>1)&(rho2<(1+3/r)**2)
        field[ring] *= .75
        field[disk] = shading[disk]
        visible_labels[disk] = len(particles)+1
        particles.append({'id':len(particles)+1, 'center_x_px':round(float(cx),3), 'center_y_px':round(float(cy),3), 'radius_px':round(r,3)})
    granular = rng.normal(0,noise,size=(SIZE,SIZE))
    noise_low = Image.fromarray(np.uint8(np.clip(rng.normal(.5,.15,(80,80)),0,1)*255)).resize((SIZE,SIZE),Image.Resampling.BILINEAR)
    coarse = (np.asarray(noise_low).astype(float)/255-.5)*.045
    pic = np.uint8(np.clip(field + granular + coarse,0,1)*255)
    img = Image.fromarray(pic,mode='L').filter(ImageFilter.GaussianBlur(radius=.35))
    img.save(OUT/f'{name}.png')
    if name.startswith('calibration'):
        # Do not penalize annotators for particles that are fully / almost fully obscured.
        truth[name] = [p for p in particles if np.count_nonzero(visible_labels==p['id']) / (np.pi*p['radius_px']**2) >= .10]
(ROOT/'calibration_truth.json').write_text(json.dumps(truth,indent=2),encoding='utf-8')
print(f'Created {len(SETUPS)} images in {OUT}')
