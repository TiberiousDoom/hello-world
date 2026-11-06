from PIL import Image
import numpy as np
from collections import Counter
# The prototype is 1024 px with each art pixel 4×4: take one sample per art pixel.
n=np.array(Image.open('prototype.png').convert('RGB'))[2::4,2::4].astype(int)
H,W,_=n.shape
BG=np.array([254,242,224])
cnt=Counter(map(tuple,n.reshape(-1,3)))
cols=sorted(cnt,key=lambda c:-cnt[c])
# merge near-duplicates into the more common colour
rep={}
keep=[]
for c in cols:
    for k in keep:
        if max(abs(a-b) for a,b in zip(c,k))<=6: rep[c]=k; break
    else: keep.append(c); rep[c]=c
out=np.array([[rep[tuple(p)] for p in row] for row in n])
# wordmark: rows 36..60, cols 16..90: one ink colour, drop specks
INK=np.array([76,48,62])
w=out[30:66,10:100]
mask=np.any(w!=BG,axis=2)
w[mask]=INK; w[~mask]=BG
out[30:66,10:100]=w
print('palette',len(set(map(tuple,out.reshape(-1,3)))))
Image.fromarray(out.astype(np.uint8)).save('clean_native.png')
Image.fromarray(out.astype(np.uint8)).resize((1024,1024),Image.NEAREST).save('clean_1024.png')
