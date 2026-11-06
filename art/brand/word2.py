from word import *
# heavier GAMES: 3-pixel strokes, 9 rows
G9={'G':[".#######.","###...###","###......","###......","###.#####","###...###","###...###","####..###",".########"],
    'A':["..#####..",".###.###.","###...###","###...###","#########","#########","###...###","###...###","###...###"],
    'M':["###.....###","####...####","#####.#####","###.###.###","###..#..###","###.....###","###.....###","###.....###","###.....###"],
    'E':["########","###.....","###.....","#######.","#######.","###.....","###.....","###.....","########"],
    'S':[".#######.","###...###","###......",".######..","..######.","......###","......###","###...###",".#######."]}
def wm(font,rows,gapmode):
    W=71; H=15+5+rows
    cv=[[0]*W for _ in range(H)]
    x0=0; place(cv,B,x0,0); x0+=14; place(cv,o,x0,5); x0+=14; place(cv,x,x0,5); x0+=18; place(cv,F,x0,0); x0+=14; place(cv,S,x0,0)
    letters=list('GAMES'); ws=[len(font[l][0]) for l in letters]
    if gapmode=='full': gap=(W-sum(ws))/4; xx=0.0
    else: gap=gapmode; xx=(W-(sum(ws)+4*gap))/2
    for l,wd in zip(letters,ws): place(cv,font[l],round(xx),20); xx+=wd+gap
    return np.array(cv,bool)
a=render(wm(G7,7,3),8,BG); b=render(wm(G9,9,'full'),8,BG); c=render(wm(G9,9,4),8,BG)
W=max(i.width for i in (a,b,c)); Hh=a.height+b.height+c.height+60
sheet=Image.new('RGB',(W,Hh),(255,255,255)); y=0
for i in (a,b,c): sheet.paste(i,(0,y)); y+=i.height+30
sheet.save('word_options.png')
