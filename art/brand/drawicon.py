from PIL import Image
import numpy as np
TOP=(218,153,98); HI=(250,193,122); FRONT=(157,103,71); RIGHT=(99,55,57)
TAPE_T=(157,103,83); TAPE_R=(73,39,54); SHADOW=(153,135,135); BG=(254,242,224)
# corners measured on the 256-pixel original (native pixels)
P=dict(tb=(110,77),fl=(67,104),fc=(144,131),rb=(192,104),bfl=(67,164),bfc=(144,192),brb=(192,159))
def inside(poly,x,y):
    c=False; n=len(poly)
    for i in range(n):
        x1,y1=poly[i]; x2,y2=poly[(i+1)%n]
        if (y1>y)!=(y2>y) and x < x1+(y-y1)*(x2-x1)/(y2-y1): c=not c
    return c
def lerp(a,b,t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)
def draw(N, transparent=False, margin=1):
    small=N<24
    ext=0 if small else 22
    s=(N-2*margin)/(125+ext); oy=(N-115*s)/2
    m={k:((x-67)*s+margin,(y-77)*s+oy) for k,(x,y) in P.items()}
    top=[m['tb'],m['rb'],m['fc'],m['fl']]
    front=[m['fl'],m['fc'],m['bfc'],m['bfl']]
    right=[m['fc'],m['rb'],m['brb'],m['bfc']]
    # tape: a band across the top, from the left edge to the right edge, then down the right face
    w=0.09
    a0,a1=lerp(m['fl'],m['tb'],0.5-w),lerp(m['fl'],m['tb'],0.5+w)
    b0,b1=lerp(m['fc'],m['rb'],0.5-w),lerp(m['fc'],m['rb'],0.5+w)
    tape_top=[a0,a1,b1,b0]
    c0,c1=lerp(m['bfc'],m['brb'],0.5-w),lerp(m['bfc'],m['brb'],0.5+w)
    tape_right=[b0,b1,c1,c0]
    sh=(m['brb'][0]-m['bfc'][0])
    shadow=[m['bfc'],m['brb'],(m['brb'][0]+sh*0.45,m['brb'][1]+0.2*sh),(m['bfc'][0]+sh*0.45,m['bfc'][1]+0.2*sh)]
    img=np.zeros((N,N,4),np.uint8)
    if not transparent: img[:,:,:3]=BG; img[:,:,3]=255
    for y in range(N):
        for x in range(N):
            px,py=x+0.5,y+0.5
            col=None
            layers=((front,FRONT),(right,RIGHT),(top,TOP)) if small else ((shadow,SHADOW),(front,FRONT),(right,RIGHT),(top,TOP),(tape_top,TAPE_T),(tape_right,TAPE_R))
            for poly,c in layers:
                if inside(poly,px,py): col=c
            if col: img[y,x,:3]=col; img[y,x,3]=255
    # a one-pixel highlight along the top face's front edge (the light comes from the upper left)
    for t in np.linspace(0,1,N*4):
        x,y=lerp(m['fl'],m['fc'],t)
        xi,yi=int(x),int(y+0.5)
        if 0<=xi<N and 0<=yi<N and tuple(img[yi,xi,:3])==FRONT: img[yi,xi,:3]=HI
    return Image.fromarray(img,'RGBA')
for N in (16,32,45,48,64):
    im=draw(N); im.save(f'mark_{N}.png'); im.resize((N*8,N*8),Image.NEAREST).save(f'mark_{N}_x8.png')
    draw(N,True).save(f'mark_{N}_clear.png')
