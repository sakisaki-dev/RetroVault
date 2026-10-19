"""League Score and OVR, exactly as used to build data/players.json.

Usage:  python ovr.py ../data/players.json
Recomputes score and ovr for every player in the games (in_games != 0) and reports any mismatch.
"""
import json, sys
from collections import defaultdict

def g(p,k): return p.get(k) or 0
def score(p):
    pos=p['pos']
    a=40*g(p,'rings')+90*g(p,'mvp')+45*g(p,'opoy')+90*g(p,'dpoy')+40*g(p,'sbmvp')+10*g(p,'roty')
    if pos=='QB': pr=g(p,'yds')/80+0.9*g(p,'td')+0.9*g(p,'rtd')-0.6*g(p,'int')
    elif pos=='RB': pr=g(p,'ryds')/18+2.2*g(p,'rtd')+g(p,'recyds')/30+2.2*g(p,'rectd')-0.8*g(p,'fum')
    elif pos in('WR','TE'):
        td=p.get('td') if p.get('td') is not None else g(p,'yds')/95
        pr=g(p,'yds')/(14 if pos=='WR' else 8)+(2.5 if pos=='WR' else 3)*td-g(p,'fum')
    elif pos=='OL': pr=5*g(p,'blk')+2*g(p,'g')
    else: pr=0.7*g(p,'tkl')+12*g(p,'int')+14*g(p,'sck')+14*g(p,'ff')
    return round(pr+a)

def ovr_by_position(players):
    groups=defaultdict(list)
    for p in players: groups[p['pos']].append(p)
    out={}
    for pos,L in groups.items():
        L=sorted(L,key=lambda q:score(q))
        for i,q in enumerate(L):
            pct=i/(len(L)-1) if len(L)>1 else 1
            out[q['n']]=round(62+37*pct**0.85)
    return out

if __name__=='__main__':
    P=[p for p in json.load(open(sys.argv[1] if len(sys.argv)>1 else 'data/players.json')) if p.get('in_games',1)]
    o=ovr_by_position(P); bad=0
    for p in P:
        if score(p)!=p['score'] or o[p['n']]!=p['ovr']: bad+=1; print('mismatch',p['n'],score(p),p['score'],o[p['n']],p['ovr'])
    print(f"{len(P)} players checked, {bad} mismatches")
