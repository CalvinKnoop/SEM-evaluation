"""Convert SEM Circle Study's downloaded JSON to CSV + NumPy instance masks.
Usage: python tools/export_to_numpy.py sem_circle_annotations_XXXXXXXX.json
Install: python -m pip install numpy
The last annotated circle wins in overlapping pixels (instance ID 0 = background).
"""
import argparse
import csv
import json
from pathlib import Path
import re
import numpy as np


def safe_name(s):
    return re.sub(r'[^a-zA-Z0-9_.-]+','_',str(s))[:100]


def convert(data_path: Path, out_dir: Path):
    bundle=json.loads(data_path.read_text(encoding='utf-8'))
    records=bundle.get('records', [])
    if not records:
        raise ValueError('JSON enthält noch keine abgeschlossenen Bilder. Bitte zuerst „Test abschließen“ drücken.')
    out_dir.mkdir(parents=True,exist_ok=True)
    index=[]
    for seq,rec in enumerate(records,1):
        h,w=int(rec['height']),int(rec['width'])
        if not (1<=h<=10000 and 1<=w<=10000): raise ValueError('Ungültige Bilddimensionen')
        image_id=safe_name(rec.get('image_id','image'))
        folder=out_dir/f'{seq:04d}_{image_id}'
        folder.mkdir(parents=True,exist_ok=True)
        mask=np.zeros((h,w),dtype=np.int32)
        rows=[]
        for circle in sorted(rec['circles'],key=lambda c:c.get('draw_order',0)):
            pid=int(circle['particle_id']);x=float(circle['center_x_px']);y=float(circle['center_y_px']);r=float(circle['radius_px'])
            if not np.isfinite([x,y,r]).all() or r<=0: continue
            # Clip to local bounding box so even large images remain manageable.
            x0=max(0,int(np.floor(x-r)));x1=min(w,int(np.ceil(x+r))+1)
            y0=max(0,int(np.floor(y-r)));y1=min(h,int(np.ceil(y+r))+1)
            if x1>x0 and y1>y0:
                yy,xx=np.ogrid[y0:y1,x0:x1]
                disk=(xx-x)**2+(yy-y)**2<=r*r
                sub=mask[y0:y1,x0:x1];sub[disk]=pid
            rows.append({'particle_id':pid,'center_x_px':x,'center_y_px':y,'radius_px':r,
                         'diameter_px':2*r,'draw_order':int(circle.get('draw_order',0))})
        np.save(folder/'instance_masks.npy',mask)
        with (folder/'circles.csv').open('w',newline='',encoding='utf-8') as fp:
            wr=csv.DictWriter(fp,fieldnames=['particle_id','center_x_px','center_y_px','radius_px','diameter_px','draw_order'])
            wr.writeheader();wr.writerows(rows)
        (folder/'metadata.json').write_text(json.dumps({
            'image_id':rec['image_id'],'image_file':rec.get('image_file'), 'annotation_id':rec.get('annotation_id'),
            'participant_id':rec.get('participant_id'),'session_id':rec.get('session_id'),
            'mode':rec.get('mode'),'duration_seconds':rec.get('duration_seconds'),
            'rasterization':'pixel-center within circle; later drawn circle overwrites earlier circle',
            'image_dimensions':[h,w],
            'warning':'Parametrische Kreismaske (nicht pixelgenaue manuelle SEM-Segmentierung)'
        },indent=2,ensure_ascii=False),encoding='utf8')
        index.append({'folder':folder.name,'image_id':rec['image_id'],'particle_count':len(rows)})
    with (out_dir/'index.csv').open('w',newline='',encoding='utf8') as fp:
        wr=csv.DictWriter(fp,fieldnames=['folder','image_id','particle_count']);wr.writeheader();wr.writerows(index)
    print(f'{len(records)} abgeschlossene Bild-Annotationen exportiert nach {out_dir.resolve()}')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description='SEM Circle Study JSON in Masken und CSV umwandeln')
    parser.add_argument('input',type=Path,help='Aus dem Browser heruntergeladene JSON-Datei')
    parser.add_argument('--output',type=Path,default=Path('exported_annotations'))
    args=parser.parse_args();convert(args.input,args.output)
