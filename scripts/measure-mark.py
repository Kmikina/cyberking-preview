#!/usr/bin/env python3
"""Measure where the brand mark sits in a rendered hero video (build-time helper for the video manifest).
Prints JSON: {"w":..,"h":..,"union":[x0,y0,x1,y1],"f0":[x0,y0,x1,y1]} in 0..1 frame coordinates.
union = bounds of the mark over the whole clip; f0 = bounds at frame 0."""
import sys, json, subprocess, tempfile, glob, os
import numpy as np
from PIL import Image
src = sys.argv[1]
probe = json.loads(subprocess.check_output(["ffprobe","-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","json",src]))
W, H = probe["streams"][0]["width"], probe["streams"][0]["height"]
sw = 480 if W >= H else 270
sh = round(sw * H / W)
with tempfile.TemporaryDirectory() as d:
    subprocess.check_call(["ffmpeg","-loglevel","error","-i",src,"-vf",f"fps=4,scale={sw}:{sh}",os.path.join(d,"f%04d.png")])
    U = None; F0 = None
    for f in sorted(glob.glob(os.path.join(d,"*.png"))):
        a = np.asarray(Image.open(f).convert("RGB")).astype(int); r,g,b = a[...,0],a[...,1],a[...,2]
        m = ((r>150)&(g<90)&(b<90)) | ((b>150)&(r<90)&(g>100))
        ys, xs = np.nonzero(m)
        if len(xs) < 20: continue
        bb = [xs.min()/sw, ys.min()/sh, (xs.max()+1)/sw, (ys.max()+1)/sh]
        if F0 is None: F0 = bb
        U = bb if U is None else [min(U[0],bb[0]),min(U[1],bb[1]),max(U[2],bb[2]),max(U[3],bb[3])]
print(json.dumps({"w":W,"h":H,"union":[round(v,4) for v in U] if U else None,"f0":[round(v,4) for v in F0] if F0 else None}))
