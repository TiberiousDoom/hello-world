from word import *
from word2 import wm, G9
import numpy as np
from PIL import Image
m=wm(G9,9,4)                      # 29 x 71
# (a) the square logo in your layout: the cleaned box art, the new wordmark at top left
n=np.array(Image.open('clean_native.png').convert('RGB'))
n[30:72,10:100]=BG
h,w=m.shape
n[40:40+h,20:20+w][m]=INK
Image.fromarray(n).save('box47_logo_256.png')
Image.fromarray(n).resize((1024,1024),Image.NEAREST).save('box47_logo_1024.png')
# (b) a wide lockup for the site header: the small box, then the wordmark (transparent)
mark=Image.open('mark_64_clear.png')
W=64+10+w; H=64
lock=Image.new('RGBA',(W,H),(0,0,0,0)); lock.paste(mark,(0,0),mark)
word=render(m); lock.paste(word,(74,(H-h)//2),word)
lock.save('box47_lockup.png')
prev=Image.new('RGBA',(W*4,H*4),BG+(255,)); big=lock.resize((W*4,H*4),Image.NEAREST); prev.paste(big,(0,0),big)
prev.save('box47_lockup_x4.png')
# side by side: before and after
o=Image.open('prototype.png').convert('RGB'); a=Image.open('box47_logo_1024.png').convert('RGB')
s=Image.new('RGB',(2048+40,1024),(255,255,255)); s.paste(o,(0,0)); s.paste(a,(1064,0)); s.save('before_after.png')
