#!/usr/bin/env python3
"""Build public/data/league/content.json (editorial league content) from data/y80.

Run from the repo root:  python3 -I scripts/build_league_content.py

The output is the *bundled default* editorial content. Everything subjective
(storylines, rivalries, lineages, snubs) lives in this JSON so it can be
replaced wholesale by a newer AI-written content.json uploaded in the app
(Commentary tab -> "Update coverage"). The format is documented in
src/utils/leagueContent.ts.

Text is copied from data/y80/league-history.md as-is, with one exception:
single-season stat records are stripped (the app no longer tracks them), via
the explicit EDITS list below. Each edit must match exactly once, so a changed
source file fails loudly instead of silently drifting.
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
SRC = os.path.join(ROOT, "data", "y80")
OUT = os.path.join(ROOT, "public", "data", "league", "content.json")

SEASON = "Y80"

# (old, new) replacements applied to league-history.md to drop single-season records.
EDITS = [
    (
        " Baylon's 7,452-yd season (Y33) is the passing season record, and his 3.55 TPG is the best of any QB.",
        " His 3.55 TPG is the best of any QB.",
    ),
    (
        "He set the 32-TD season (Y38), 5-TD game (Y40), 2,104-yd season (Y42, 1 yard short of Dickerson's real record) and career rushing marks.",
        "He set the 5-TD game (Y40) and career rushing marks.",
    ),
    ("Set the 9-TD game and 94-TD season (Y55).", "Set the 9-TD game."),
    # User-confirmed: Avonte Gooden was the QB for the Commanders run.
    (
        "Four straight titles. Alexx Sanchez's 4 rings fit as the QB, but Jayden Daniels and Avonte Gooden are also listed as Commanders, so this is unconfirmed.",
        "Four straight titles with Avonte Gooden at quarterback.",
    ),
    ("Lamar → Sanchez (likely) → Waller", "Lamar → Gooden → Waller"),
    ("- Who played QB for the Commanders run (Sanchez or Daniels)?\n", ""),
]

# User-confirmed player storyline tags (override players.json `tag`).
PLAYER_TAG_FIXES = {
    "Avonte Gooden": "QB of the Commanders four-peat (Y16–19)",
    "Malakai Sawyer": "Won CXXXI with the Titans (Y72), then CXXXVI with the Jets (Y77); traded to the Falcons for Y80",
    "Jason Macleone": "QB of the Vikings' Y78 title (CXXXVII); now with the Seahawks",
    "Levante Hopkins": "Tight end for the Titans' Y70–72 three-peat",
    "Rondale Ikarras": "Ravens legend and record setter with 0 MVPs; final season with the Jets",
}

# Real franchises for players the screenshots mark CUR (current club = Jets) or UNK; mirrors
# TEAM_FIXES in scripts/build_league_data.py.
CURRENT_CLUB = "Jets"
PLAYER_TEAM_FIXES = {
    "Jason Macleone": "Seahawks",
    "Malakai Sawyer": "Jets",
    "Levante Hopkins": "Titans",
}

# Hall of Fame classes (shared data, so every device shows the same history). Everyone enshrined before the
# Y80 screenshot uploads is the inaugural class (the HOF tab's default); these crossed 7000 Career Legacy with them.
HOF_CLASSES = [
    {"label": "Y80", "keys": ["QB:Michael Wilson", "DB:Dan Mosley", "DB:Taron Hayes", "QB:Jason Macleone", "OL:Jakeem Friend"]},
]

# Induction speeches for the inaugural Hall of Fame class, written from the user's descriptions and
# the players' real career numbers. The first paragraph is the headline caption the ceremony shows large.
# Only facts from data/y80 are cited (no single-season marks; God Johnson's reception total is an estimate).
SPEECHES = {
    "Sherman Brandson": """The General never flinched.

Six-foot-seven, built like a tank, and calm enough to put a defense to sleep before he broke its heart. Sherman Brandson stood in the pocket like it belonged to him, and for twenty seasons it did. Pass rushers came in waves and bounced off. Fifty sacks in 315 games. Most quarterbacks give that up in a few bad years.

The numbers read like a typo: 91,463 passing yards, 1,150 touchdown passes, eight MVPs and ten rings, four of them with the Super Bowl MVP trophy in his hands. He looked more like a linebacker than a quarterback, and he played like a man who knew exactly how the next five plays would go.

He did not celebrate much. He did not need to. General Sherman, welcome to the Hall of Fame.""",
    "God Johnson": """He changed his name to God. Then he earned it.

Mason Earl III walked into the league as a receiver. God Johnson walked out as the standard every receiver gets measured against. Some people thought the name was a joke. Defensive coordinators never laughed.

36,005 receiving yards. 378 receiving touchdowns. Ten rings with the Vikings dynasty and five Super Bowl MVPs, because when the lights were brightest the ball found him. And three fumbles. In his entire career. Ian Finney's career receiving mark stood for decades until God took it, with Jackson Wardell Kline lined up beside him.

There is not much left to say about a man who named himself after the only being with a better résumé. God Johnson, welcome to the Hall of Fame.""",
    "Levante Hopkins": """The quiet one who did the dirty work.

Levante Hopkins never looked the part. Glasses off the field, soft-spoken in the locker room, the guy you would mistake for a team analyst. Then he put the helmet on, and nobody in the league wanted to be the one assigned to him.

He played 291 games and caught 1,194 passes for 12,353 yards and 174 touchdowns. He won nine rings and was Super Bowl MVP twice. He was the tight end at the center of the Titans' three-peat from Y70 to Y72: blocking on first down, finding the soft spot on third, and finishing in the red zone.

He never asked for the ball. He just made it hard to lose with him on the field. Levante Hopkins, welcome to the Hall of Fame.""",
    "Ian Finney": """The first superstar. The Infinity Man.

Before the dynasties had names, there was Ian Finney. He was the first player in this league who made you stop what you were doing to watch, the receiver every kid in the backyard pretended to be.

He started with the Commanders' four-peat, then carried the Buccaneers through the Waller–Finney era with Tyrion Kline at his side: nine rings, four in Washington and five in Tampa Bay. He caught 1,902 passes for 32,980 yards and 292 touchdowns at 17.3 yards a catch, and every one of them looked effortless. Add five Offensive Player of the Year awards, an MVP and three Super Bowl MVPs.

Every great receiver who came after him was chasing Ian Finney. Most of them still are. The Infinity Man, welcome to the Hall of Fame.""",
    "Rondale Ikarras": """Flashy, loud, unstoppable, and he knew it. He was that guy.

Rondale Ikarras never just ran through a hole. He ran through it with style, pointed at the crowd, and made sure the cameras got his good side on the way to the end zone. The Prodigal Son played like every snap was a highlight reel, and most of them were.

23,178 rushing yards. 374 rushing touchdowns. Nine rings, four Offensive Player of the Year awards and five Super Bowl MVPs. The career rushing records carry his name. He won three straight titles in Seattle, then built his legend in Baltimore, where five more rings came with the Ravens, and took one last ride with the Jets before hanging it up.

Zero regular-season MVPs. He will tell you about that one. Rondale Ikarras, Ravens legend, welcome to the Hall of Fame.""",
    "Jakeem Friend": """Linemen do not win trophies. Jakeem Friend won six rings instead.

For most of his career he was a Seattle Seahawk, a fixture up front through the Modern era. He played 214 games and was credited with 427 blocks, two a game, every game, without a single MVP or Player of the Year award to show for it. That is how the job works. The reward is a quarterback who gets up clean and a running back who finds the hole where it was supposed to be.

The last two seasons have come in New York, with the Jets in Y79 and Y80. The jersey changed. The job did not, and Seattle still has first claim on him.

Six rings, 427 blocks, and almost no headlines. Jakeem Friend, Seahawks legend, welcome to the Hall of Fame.""",
    "Charlie John": """Seven straight Super Bowls. Charlie John was there for every one of them.

CJ was the tight end in the middle of the Bills dynasty, seven titles in a row from Y27 to Y33, LXXXVI through XCII. Dennis Baylon went 7-for-7 in Super Bowls in that stretch, and John's ring count matches him exactly, as do Tyrone Baugh's and Rob Lowe's. That was the core. He was part of it.

He caught 840 passes for 9,980 yards and 150 touchdowns in 197 games. More than one catch in six went for a score, which tells you where the ball went when Buffalo got close. He was not there to stretch the field. He was there to finish drives, and he finished a lot of them. He even took home a Super Bowl MVP of his own.

Twenty yards short of 10,000 for his career. Nobody in Buffalo cares. CJ, welcome to the Hall of Fame.""",
    "Lukas Russell": """The Running Man started fast and never slowed down.

Lukas Russell was Rookie of the Year in his first season and retired a Seahawk 271 games later. In between he caught 1,675 passes for 24,547 yards and 265 touchdowns. That is 14.7 yards a catch over a career that long: deep enough to make safeties back up, steady enough to keep the chains moving.

He played in the Ikarras era, when Rondale Ikarras was taking every rushing record in the book, and he still found room to collect four Offensive Player of the Year awards and eight rings. Then there is the trophy that settles a lot of arguments. Russell won a regular-season MVP. Ikarras, with all those records, never did.

Fifteen fumbles in 1,675 catches. Quarterbacks trusted him with the ball, and he gave it back to them in the end zone. Running Man, welcome to the Hall of Fame.""",
    "Nick Bolton": """One of the originals, and he never stopped tackling.

Nick Bolton came into this league with the imported NFL rosters of the Real-roster era, the players who set the first marks before the league started making its own stars. He played 253 games and finished his career a Minnesota Viking.

He was the complete linebacker. 1,233 tackles, close to five a game. Seventeen interceptions and eighteen sacks, almost a perfect split between dropping into coverage and coming after the quarterback. He forced exactly one fumble in his whole career, which says something about how he played: wrap up, put the man on the ground, line up again.

Three rings. No individual awards. Just 253 games of showing up and doing the job, which is its own kind of greatness. Nick Bolton, welcome to the Hall of Fame.""",
    "Michael Wilson": """Wayne's brother, and nobody's afterthought.

Michael Wilson broke in with the Ravens, made his name with the Giants and finished as a Titan. He was a pocket passer in the purest sense: 413 rushing yards in his entire career, because he never needed to run. He completed 72 percent of his passes over 214 games for 58,992 yards and 690 touchdowns, more than three touchdown passes a game.

Six MVPs. Six rings to go with them. There was one exception to the no-running rule, and it was near the goal line, where he kept it himself and scored 36 rushing touchdowns on only 101 carries.

His prime ran through Baltimore and New York in the years of Ikarras and Brandson, while his brother Wayne's name rested on durability. Michael's career ended as a Titan, cut short by injury, and the numbers he left behind still hold up against anyone's. Michael Wilson, welcome to the Hall of Fame.""",
    "Mose Junior": """Some players chase rings. Mose Junior chased ball carriers.

He made his name with the Rams, one of the stars who never wore the colors of the dynasties that ran this league. He spent his career trying to stop them instead. Mose Junior never won a ring. He did not need one to get here.

He made 2,862 tackles in 247 games. That is 11.6 a game from a defensive back, a number that belongs to a linebacker. He was a hitter first and always, the player who arrived at the ball carrier before anyone else in the secondary. And he took the ball away too: 35 interceptions over his career, plus a Defensive Player of the Year award.

The Hall is not only for the men who won the last game. It is also for the ones who made every game harder to win. Mose Junior, welcome to the Hall of Fame.""",
    "Lamar Jackson": """The league never had to explain who he was. He was just Him.

Lamar Jackson arrived with the imported rosters of the Real-roster era, and the early marks were his to set. Over 345 games he threw for 71,958 yards and 682 touchdowns, then ran for 7,939 more yards and 95 scores. That is 6.2 yards a carry from a quarterback. Defenses could cover every receiver on the field and still lose to the man taking the snap.

He was not careless with it either: 141 interceptions on 9,885 attempts, roughly one every 70 throws. His longest pass went 84 yards. His longest run went 79. Either way, the play was never over until he was down.

Four MVPs and two rings. Baltimore was home for the heart of it, and he finished his career in Green Bay. Him. Lamar Jackson, welcome to the Hall of Fame.""",
    "Tyler Pacheco": """Tyler Pacheco never needed the big play. He needed the ball, and he got it.

Over 290 games the Packers tight end caught 1,384 passes for 10,749 yards and 124 touchdowns. That is under eight yards a catch, the profile of a target who lived in the short middle of the field, where the hits come fast and the catches have to be made anyway. He was a volume player in the best sense. Nearly 1,400 receptions is a career's worth of quarterbacks deciding he was the safe throw.

He won Offensive Player of the Year once and collected four rings. And he lasted: 290 games, one fewer than Levante Hopkins, at a position that wears players down.

He was never the flashiest name on the field. He was the one who was always open. Tyler Pacheco, welcome to the Hall of Fame.""",
    "Taron Hayes": """Twice the league looked at every defender in football and picked Taron Hayes.

He made his name in Kansas City during the Modern era, Y70 to Y80, the years of the Titans three-peat and the Jets' titles. Hayes never got a ring out of it. What he got was two Defensive Player of the Year awards, in an era stacked with champions.

He played 213 games and made 2,418 tackles, more than eleven a game, the kind of volume that means he was always around the ball. He also picked off 30 passes, about one every seven games. A defensive back who tackles like a linebacker and still takes the ball away does not come along often.

The rings went elsewhere. The respect never did. Taron Hayes, welcome to the Hall of Fame.""",
    "Dennis Baylon": """Seven trips to the Super Bowl. Seven rings. Not one loss.

Dennis Baylon was the quarterback of the Bills dynasty, and from Y27 to Y33 Buffalo did not lose on the final Sunday of a season. The Iron Island completed 75.7 percent of his passes over 253 games, the kind of accuracy that turns a playbook into a metronome. He threw for 69,448 yards and 779 touchdowns against 134 interceptions, and when the field got short he kept it himself, running in 81 more scores.

The league remembers him for one word: clutch. Four times he walked off the Super Bowl field as its MVP, and he collected three regular-season MVPs along the way. Charlie John, Tyrone Baugh and Rob Lowe each matched his seven rings, and the Bills went 113-6 in the regular season across those seven years.

He took his final snaps as a Charger. Buffalo still claims him. The Iron Island, welcome to the Hall of Fame.""",
    "Zander Kolar": """Some defensive linemen are measured in sacks. Zander Kolar was measured in tackles.

He played 261 games up front and made 1,278 of them, close to five a game from a spot on the field where most players settle for two. The sack total stayed modest at 19, and that was never the point. Kolar lived at the line of scrimmage and ended running plays before they had a chance to become anything. Two forced fumbles and a lone interception round out a stat line built on repetition rather than flash.

Tampa Bay was home, and he arrives here with four rings. He never won an MVP or a Defensive Player of the Year award, and he never seemed to need the voters. Running backs knew exactly where he was. Offensive coordinators spent his whole career drawing up plays that went somewhere else.

Zander Kolar, welcome to the Hall of Fame.""",
    "Jayon Queen": """Two Defensive Player of the Year awards. Only one other player in this league has ever matched that.

Jayon Queen made 2,838 tackles in 274 games. That is more than ten a game, every game, for a career long enough to outlast most coaching staffs. For a defensive back it is not a stat line, it is a warning. He was the hitter in the secondary, the player who got to the ball carrier first and usually finished the play alone.

And he could cover. Forty interceptions say quarterbacks tested him often enough to regret it.

Queen spent his career with the Jets and never won a ring. He was one of the great stars who never played for the coach who built this league's dynasties, which meant he spent his Sundays on the other side of them, making every champion earn it. FOV, welcome to the Hall of Fame.""",
    "Jackson Wardell Kline": """Tyrion Kline's son did not live in anyone's shadow. He built his own.

Jackson Wardell Kline grew up with a famous name. His father stood beside Ian Finney through the Waller–Finney era, and the son could have spent a career being introduced as somebody's kid. Instead he won six Offensive Player of the Year awards, one more than Finney himself.

He piled up 28,331 receiving yards and 289 touchdowns in 237 games, close to 120 yards a game. He lined up beside God Johnson in the Vikings dynasty, when every receiver in the league was measured against two names, and Kline made it three: eight rings, a league MVP and a Super Bowl MVP of his own.

He broke in with the Giants, won it all again and again in Minnesota, and finished his career in Miami. The Kline family now has a second chapter worth telling, and this one is all his. Jackson Wardell Kline, welcome to the Hall of Fame.""",
    "Tyrone Baugh": """Seven seasons, seven championships, and Tyrone Baugh has a ring for every one of them.

He was the linebacker at the center of the Bills dynasty, the defender who did a little of everything and all of it well. In 158 games he made 656 tackles, intercepted 15 passes, sacked the quarterback 21 times and forced 11 fumbles. Most linebackers are run stoppers, pass rushers or cover men. Baugh was all three, with a habit of taking the ball away.

Dennis Baylon got the headlines on offense. Baugh's defense made sure the Super Bowls were rarely close: the Rams managed 7 points in Y30, the Commanders 14 in Y32, the Panthers 14 in Y33. When it was over, Baugh, Baylon, Charlie John and Rob Lowe each walked away with exactly seven rings.

He never won an individual award. Seven rings will do. Tyrone Baugh, welcome to the Hall of Fame.""",
    "Amani Bryant": """The best quarterback never to win a ring.

Amani Bryant played 416 games, a career long enough to watch whole dynasties rise and fall around him. He threw for 79,121 yards and 763 touchdowns, and he protected the football like it was borrowed: 62 interceptions on 13,029 attempts, roughly one every 210 throws.

Then there were the legs. Bryant ran for 2,292 yards and 124 touchdowns, a quarterback who finished drives himself whenever the end zone came into view. Defenses had to account for his arm and his feet on every snap, for more than four hundred games.

He won a league MVP. He never won the last game of a season. Bryant is one of the stars who never played for the coach who collected most of this league's trophies, so he spent his career trying to beat that coach's teams instead. The ring never came. The respect always did.

Amani Bryant, welcome to the Hall of Fame.""",
    "Cooper Dean": """The best offensive lineman in the league never needed a highlight. He just needed a man in front of him.

Cooper Dean anchored the Commanders' line for 292 games and recorded 345 blocks, nearly three hundred games of the least glamorous work in football. Every clean pocket and every open running lane started with somebody like him, and for most of his career there was nobody quite like him. Quarterbacks stayed upright. Running backs found daylight. The man responsible rarely heard his name over the stadium speakers.

He was called the best lineman in the league, and nobody put up much of an argument. Dean never played for the coach who built this league's dynasties, so he spent his career trying to hold them back. One ring came anyway, the reward for doing the job right on every snap.

Linemen do not usually get the last word. Cooper Dean, welcome to the Hall of Fame.""",
    "Akiem Bouye": """Akiem the Dream was there at the beginning.

Akiem Bouye arrived in the real-roster era, when imported NFL stars set the league's first marks, and he started his career by winning Rookie of the Year. Then he kept going for 273 games.

He caught 1,237 passes for 10,212 yards and 131 touchdowns. At about 8.3 yards a catch he was never a deep threat, and he did not need to be. He was the chain mover, the tight end a quarterback looked for on third down and near the goal line, with a 73-yard catch to prove he could still run away from people when the opening was there.

The Chargers won four titles in those early years, in Y10, Y11, Y14 and Y15, and Bouye has four rings to match. He finished his career where he made it, in a Chargers uniform. Akiem the Dream, welcome to the Hall of Fame.""",
    "Forrest Everett": """Hand Forrest Everett the ball near the goal line and send the kicking team out for the extra point.

Everett carried it 2,270 times in 290 games for 16,283 yards and 321 rushing touchdowns. That is 7.2 yards a carry and a touchdown roughly every seven times he touched it on the ground. Defenses knew where the ball was going and still could not keep him out of the end zone.

He was not a receiver by trade, with only 109 catches in his career, but 41 of them went for touchdowns. When his teams threw it to him, they were usually looking for points.

Four rings, no MVPs and no Offensive Player of the Year awards. Everett was never the face of the league, just the running back nobody wanted to see in the red zone. Forrest Everett, welcome to the Hall of Fame.""",
    "Cairo Asanjh": """Some players chase records. Cairo Asanjh chased Ian Finney.

They called him The Prophecy, and for more than a decade he delivered on it. Asanjh caught 1,642 passes for 27,508 yards and 280 touchdowns in 250 games, almost 17 yards a catch. He stretched defenses deep, and he held on to the ball while doing it: nine fumbles in his entire career.

He was a cornerstone of the Bills dynasty, seven straight titles alongside Dennis Baylon, and he carried that winning into Seattle. Nine rings, three MVPs, two Offensive Player of the Year awards and two Super Bowl MVPs. Three MVPs as a receiver tells you how much of the offense ran through him.

He finished his career in Baltimore, still within sight of the mark set by the league's first superstar. He never caught Finney. He built a career few receivers will ever touch. The Prophecy, welcome to the Hall of Fame.""",
    "Wayne Wilson": """Four hundred thirty-one games. Nobody in this league has played longer.

Wayne Wilson's greatest weapon was simple: he was always there. Season after season he lined up under center while the league turned over around him, and the numbers piled up behind him. 90,450 passing yards, 913 touchdown passes and a 67 percent completion rate. That yardage total sits barely a thousand yards behind Sherman Brandson's 91,463.

He was no scrambler, with 1,811 rushing yards across all those games, but near the goal line he handled it himself: 88 rushing touchdowns on just 324 carries.

He won five MVPs, four rings and a Super Bowl MVP across stops with the Chargers and the Bills, and with his brother Michael he gave the league's long line of great quarterbacks its Wilson brothers chapter. He finished his career in Buffalo, still standing.

Durability is a skill. Nobody had more of it. Wayne Wilson, welcome to the Hall of Fame.""",
    "Jahmyr Gibbs": """Mr. Incredible was here at the start, and he set the bar high.

Jahmyr Gibbs arrived with the real-roster era, when imported NFL players set the league's first marks, and he made the Dolphins backfield his own. He carried 2,443 times for 16,644 yards and 307 rushing touchdowns, 6.8 yards a carry. Then he caught 689 passes for 4,816 yards and 115 more scores. Defenses had to find him on every snap, in the backfield or out in the flat.

He was not tidy. 140 fumbles says so. But a back averaging nearly seven yards a carry gets the ball back, and Gibbs kept giving his coaches reasons to hand it over: 422 total touchdowns, four rings and a Super Bowl MVP.

Miami was his home, and he retired a Dolphin. Every running back who came later was measured against the numbers he put up first. Mr. Incredible, welcome to the Hall of Fame.""",
    "Ray Waller": """Never count out a man whose nickname is a promise.

Ray Waller threw the ball downfield and dared you to stop it. He completed 5,510 of 7,388 passes, nearly 75 percent, for 70,128 yards and 749 touchdowns, and his 9.5 yards per attempt tell you how far downfield he liked to live. The 214 interceptions were the price of attacking. He took only 57 sacks and never lost a fumble in 278 games.

Waller was the quarterback of the Buccaneers' golden run alongside Ian Finney and Tyrion Kline. Tampa Bay won five titles in his era, and Waller has five rings and five MVPs to match, plus two Super Bowl MVPs. The two Super Bowls that got away went to his great rival, Kyric McQuay, and the Colts.

He won in Tampa, and he retired in Tampa. The deep ball was his signature, and the comeback was his name. Ray Comeback Waller, welcome to the Hall of Fame.""",
    "Lloyd Queen": """Some linemen hunt quarterbacks. Lloyd Queen hunted everybody else.

Queen was Rookie of the Year right out of the gate, and then he spent 283 games proving it was no accident. He finished with 1,364 tackles, nearly five a game, a staggering total for a man lined up on the defensive line. Eight sacks and a single interception tell you his job was never the glamour work. He took on the run, filled his gap and made the play in front of him, game after game.

He never won a ring. He never won Defensive Player of the Year. There were no Super Bowl MVP trophies on his shelf. He got here on volume and staying power alone, which is the hardest way in.

Tampa Bay fans remember the Buccaneer who was always around the ball. Now the Hall of Fame will too. Lloyd Queen, welcome to the Hall of Fame.""",
    "Dan Mosley": """2,658 tackles from a defensive back. Read that again.

Dan Mosley played in the secondary like a linebacker who had wandered back to cover. Over 248 games he averaged more than ten tackles a game, a number most run stoppers never touch. And he still found the ball in the air, with 37 career interceptions. A hitter and a ballhawk in the same Lions jersey.

He did it in the modern era, from Y70 to Y80, while the Titans three-peated and the Jets and Vikings took their turns. Detroit was never the team lifting the trophy, and Mosley retires without a ring. What he does have is a Defensive Player of the Year award, the most heavily weighted honor in this league's Dominance formula, worth twice as much as a ring.

Nobody had to tell ball carriers where Dan Mosley was. They found out. Dan Mosley, welcome to the Hall of Fame.""",
    "Bilal Tolbert": """No individual trophies. Four rings. And a sack record nobody has caught.

Bilal Tolbert played 210 games at linebacker and did every job the position asks for. He made 937 tackles, about four and a half a game. He intercepted 13 passes and forced 8 fumbles. And his 22 career sacks are the most in league history, a mark that still stands.

There were no MVP votes, no Defensive Player of the Year award and no Super Bowl MVP. Tolbert never needed them. He collected four rings in the Chargers' early title years, the linebacker who was in the right place on first down, second down and third.

He began in Seattle and finished his career as a Charger. Both teams got the same player: steady, versatile and always near the ball. Bilal Tolbert, welcome to the Hall of Fame.""",
    "Pharoah Hunter": """The other receiver in the Vikings dynasty was never anybody's second option.

Pharoah Hunter broke in as Rookie of the Year and spent his prime in Minnesota, where God Johnson and Jackson Wardell Kline were rewriting the receiving records. Hunter did not need the spotlight to matter. He caught 1,523 passes for 23,261 yards and 260 touchdowns in 233 games, a little over 15 yards a catch, with a 70-yarder to prove he could take the top off a defense.

Four Offensive Player of the Year awards say the voters noticed. Four rings say the Vikings won with him. Twice he was the best player on the field on the biggest night of the year, with two Super Bowl MVPs.

He finished his career in Seattle. Minnesota remembers a receiver who made a stacked offense even harder to stop. Pharoah Hunter, welcome to the Hall of Fame.""",
    "Kyric McQuay": """Twice in three seasons the Buccaneers reached the Super Bowl and lost. Kyric McQuay was the reason both times.

Baby Manning did not beat you with arm strength. He beat you with decisions. In 10,099 pass attempts he threw only 43 interceptions, roughly one every 235 throws. He completed 6,048 passes for 53,797 yards and 562 touchdowns, and when the pocket broke down he could take it himself: 1,997 rushing yards and 107 rushing touchdowns.

He was Ray Waller's great rival through the Waller and Finney era, and twice his Colts met the Buccaneers on the biggest stage. Twice McQuay won, 38-32 in Super Bowl LXXXI and 29-28 in LXXXIII, the closest of finishes. Two rings, and two Super Bowl MVPs to go with them.

The best teams in this league rarely lost when it mattered. McQuay is one of the few who made them. Baby Manning, welcome to the Hall of Fame.""",
    "Jason Macleone": """One look at Scary Jerry and you understood the name.

Jason Macleone was imposing before he ever threw a pass, and then he threw 8,883 of them. He completed 67 percent for 66,411 yards and 701 touchdowns, with just 124 interceptions across 296 games. He took 83 sacks and never lost a fumble. When he did tuck it and run, he made it count: 64 rushing touchdowns.

His defining day came in Y78, when he quarterbacked the Vikings past the Broncos 33-27 in Super Bowl CXXXVII. Two rings, three MVPs and a Super Bowl MVP in all, before he took his game to Seattle and finished his career as a Seahawk.

The league's line of great quarterbacks runs from Lamar through Gooden, Waller, Baylon, Brandson and the Wilson brothers. For now, it ends with him. Scary Jerry, welcome to the Hall of Fame.""",
}

# User-confirmed corrections to eras.json, keyed by era name.
ERA_FIXES = {
    "Commanders run": {
        "key_players": ["Avonte Gooden", "Ian Finney", "Brennan Higgins"],
        "notes": "Four straight titles with Avonte Gooden at quarterback.",
    },
    "Ikarras era": {
        "notes": "Ikarras's 9 rings match your 9 titles in this window, and every rushing record falls. "
        "He won three titles in Seattle (Y36–38), became a Ravens legend in Baltimore (Y41–47) and finished his career with one season as a Jet.",
    },
    "Modern era": {
        "key_players": ["Malakai Sawyer", "Jason Macleone", "Levante Hopkins", "Chance Woodrum"],
        "notes": "Titans three-peat (Y70–72) with Levante Hopkins at tight end and Malakai Sawyer in his one "
        "Titans season, then a loss to those same Titans as the Seahawks in CXXXIII (Y74). The Jets, your "
        "current club, won CXXXVI (Y77) with Sawyer. Jason Macleone, now a Seahawk, quarterbacked the Vikings "
        "to the Y78 title (CXXXVII). Sawyer was traded to the Falcons ahead of Y80.",
    },
}


def team_for(p):
    """Real franchise for a player note: user-confirmed fixes, CUR -> current club, UNK -> none."""
    team = PLAYER_TEAM_FIXES.get(p["n"], p.get("team"))
    if team == "CUR":
        return CURRENT_CLUB
    return None if team == "UNK" else team


def load(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return json.load(f) if name.endswith(".json") else f.read()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("’", "").replace("'", "")).strip("-")


def parse_years(years):
    """'Y1–15' -> (1, 15)."""
    m = re.match(r"Y(\d+)\s*[–-]\s*Y?(\d+)", years)
    if not m:
        raise ValueError(f"Unparseable era years: {years!r}")
    return int(m.group(1)), int(m.group(2))


def split_sections(md, level):
    """Split markdown into {heading: body} for headings of exactly `level` #'s."""
    prefix = "#" * level + " "
    out, cur, buf = {}, None, []
    for line in md.splitlines():
        if line.startswith(prefix):
            if cur is not None:
                out[cur] = "\n".join(buf).strip()
            cur, buf = line[len(prefix):].strip(), []
        elif cur is not None:
            if re.match(r"^#{1,%d} " % level, line):  # higher-level heading ends the section
                out[cur] = "\n".join(buf).strip()
                cur, buf = None, []
            else:
                buf.append(line)
    if cur is not None:
        out[cur] = "\n".join(buf).strip()
    return out


def bullets(body):
    return [l[2:].strip() for l in body.splitlines() if l.startswith("- ")]


def table_rows(body):
    rows = [l for l in body.splitlines() if l.startswith("|")]
    parsed = [[c.strip() for c in r.strip("|").split("|")] for r in rows]
    return parsed[2:] if len(parsed) > 2 else []  # skip header + separator


def first_sentence(text):
    plain = re.sub(r"\*\*|__|\*", "", text).strip()
    plain = re.sub(r"^[-|]\s*", "", plain.split("\n")[0])
    m = re.match(r"(.+?[.!?])(\s|$)", plain)
    return (m.group(1) if m else plain).strip()


# Surnames too generic to match on their own in prose.
SURNAME_STOPLIST = {"Hall", "John", "Junior", "Wood", "Square", "Candy", "Fox", "Baker", "Rice", "Daniel", "Lamb",
                    "Chase", "Jackson", "Queen", "Taylor", "Wilson", "Kline", "Hunter", "Ankou", "Irving", "Rankin"}


def main():
    eras_src = [{**e, **ERA_FIXES.get(e["name"], {})} for e in load("eras.json")]
    sbs_src = load("super_bowls.json")
    players_src = load("players.json")
    md = load("league-history.md")

    for old, new in EDITS:
        if md.count(old) != 1:
            sys.exit(f"Edit did not match exactly once: {old[:60]!r}")
        md = md.replace(old, new)

    known_names = sorted({p["n"] for p in players_src}, key=len, reverse=True)

    surname_counts = {}
    for n in known_names:
        last = n.split()[-1]
        surname_counts[last] = surname_counts.get(last, 0) + 1

    def mentioned(text):
        """Known player names referenced in text: full names first, then unambiguous surnames."""
        found = []
        for n in known_names:
            if n in text and not any(n in f for f in found):
                found.append(n)
        for n in known_names:
            last = n.split()[-1]
            if n in found or surname_counts[last] > 1 or last in SURNAME_STOPLIST:
                continue
            if re.search(r"\b%s\b" % re.escape(last), text):
                found.append(n)
        return found

    # ---- Super Bowls -------------------------------------------------------
    super_bowls = []
    for sb in sbs_src:
        super_bowls.append({
            "number": sb["number"],
            "roman": sb["roman"],
            "year": int(sb["year"].lstrip("Y")),
            "winner": sb["winner"],
            "loser": sb["loser"],
            "score": sb["score"],
            "yourResult": sb["your_result"],
            "yourTeam": sb["your_team"],
        })

    # ---- Eras --------------------------------------------------------------
    h2 = split_sections(md, 2)
    era_md = split_sections(h2["Eras"], 3)
    era_sections = {}
    for heading, body in era_md.items():
        m = re.match(r"\d+\.\s*(.+?)\s*\(", heading)
        if m:
            era_sections[m.group(1).strip()] = body

    eras = []
    for e in eras_src:
        start, end = parse_years(e["years"])
        history = era_sections.get(e["name"], "")
        eras.append({
            "id": slug(e["name"]),
            "name": e["name"],
            "startYear": start,
            "endYear": end,
            "superBowlRange": e["super_bowls"],
            "yourTeams": e["your_teams"],
            "keyPlayers": e["key_players"],
            "rival": e.get("rival"),
            "notes": e["notes"],
            "history": history,
        })

    # ---- Storylines --------------------------------------------------------
    storylines = []

    def add(**kw):
        kw.setdefault("players", mentioned(kw["body"]))
        kw.setdefault("summary", first_sentence(kw["body"]))
        storylines.append({k: v for k, v in kw.items() if v is not None})

    record = h2["Your record"]
    record_bullets = record.split("\n\n")[0]
    add(id="your-record", headline="54–6 IN THE BIG GAME",
        subheadline="Sixty Super Bowl appearances, Y1 through Y79",
        body=record_bullets, tier="breaking", category="Dynasty Ledger")

    era_tiers = ["analysis", "milestone", "analysis", "milestone", "controversy", "analysis", "milestone", "analysis"]
    for i, era in enumerate(eras):
        body = era["history"]
        rival_para = None
        paras = body.split("\n\n")
        kept = []
        for p in paras:
            if p.startswith("**The rival:**"):
                rival_para = p
            else:
                kept.append(p)
        body = "\n\n".join(kept)
        era["history"] = body
        era["_rival_para"] = rival_para
        add(id=f"era-{era['id']}", headline=era["name"].upper(),
            subheadline=f"Y{era['startYear']}–{era['endYear']} · Super Bowls {era['superBowlRange']} · {', '.join(era['yourTeams'])}",
            body=body, tier=era_tiers[i % len(era_tiers)], category="Era Report", era=era["name"])

    # Rivalries
    rivalries = []
    for era in eras:
        para = era.pop("_rival_para")
        if not para:
            continue
        text = para.replace("**The rival:** ", "")
        meetings = [
            {"roman": sb["roman"], "year": sb["year"], "score": sb["score"], "result": sb["yourResult"],
             "yourTeam": sb["yourTeam"], "opponent": sb["winner"] if sb["yourResult"] == "lost" else sb["loser"]}
            for sb in super_bowls
            if era["startYear"] <= sb["year"] <= era["endYear"] and sb["yourResult"] == "lost"
        ]
        rivalries.append({
            "id": f"rival-{era['id']}",
            "rival": "Kyric McQuay" if "McQuay" in text else mentioned(text)[0],
            "team": meetings[0]["opponent"] if meetings else None,
            "era": era["name"],
            "summary": text,
            "meetings": meetings,
        })
        add(id=f"rivalry-{era['id']}", headline="THE ONE WHO GOT AWAY",
            subheadline=era["rival"], body=text, tier="hot-take", category="Rivalry", era=era["name"])

    # Lineages
    lineages = []
    for b in bullets(h2["Lineages"]):
        m = re.match(r"\*\*(.+?):\*\*\s*(.+)", b)
        label, rest = m.group(1), m.group(2)
        chain_part, _, note = rest.partition(". ")
        chain = [c.strip().rstrip(".") for c in chain_part.split("→")]
        lineages.append({"id": slug(label), "label": label, "chain": chain, "note": note.strip() or None})
    add(id="lineages", headline="PASSING THE TORCH", subheadline="Quarterback and receiver lineages across 80 seasons",
        body=h2["Lineages"], tier="analysis", category="Lineage")

    # Snubs
    snubs = []
    for b in bullets(h2["Snubs"]):
        m = re.match(r"\*\*(.+?)\*\*:?\s*(.+)", b)
        title = m.group(1).rstrip(":") if m else None
        snubs.append({"id": slug(title or b[:30]), "title": title, "summary": b, "players": mentioned(b)})
    add(id="snubs", headline="ZERO MVPS, EVERY RECORD", subheadline="The league's biggest snubs",
        body=h2["Snubs"], tier="controversy", category="Snub Watch")

    # Outsiders
    outsiders = [
        {"player": r[0], "position": r[1].split(",")[0].strip(), "team": r[1].split(",")[1].strip() if "," in r[1] else None, "summary": r[2]}
        for r in table_rows(h2["Best players who never played for you"])
    ]
    add(id="outsiders", headline="THE ONES THAT GOT AWAY", subheadline="Best players who never played for you",
        body=h2["Best players who never played for you"], tier="hot-take", category="Outside the Dynasty",
        summary="Amani Bryant, Nico Curl, Jayon Queen and the stars who never wore your colors.")

    add(id="metrics", headline="THE RING TAX", subheadline="What your spreadsheet metrics get wrong",
        body=h2["Your spreadsheet metrics"], tier="controversy", category="Analytics")
    add(id="composites", headline="BUILD THE PERFECT PLAYER", subheadline="Composite greats at every position",
        body=h2['Composite "perfect" players'], tier="power-ranking", category="Fantasy Draft")

    open_questions = bullets(h2["Open questions"])
    add(id="open-questions", headline="UNSOLVED MYSTERIES", subheadline="What the archives can't confirm",
        body=h2["Open questions"], tier="analysis", category="Open Questions")

    # Player storyline tags (era + tag) from players.json
    player_notes = [
        {k: v for k, v in {"name": p["n"], "team": team_for(p), "position": p.get("pos"), "nickname": p.get("nick"),
                           "era": p.get("era"), "tag": PLAYER_TAG_FIXES.get(p["n"], p.get("tag"))}.items() if v}
        for p in players_src if p.get("tag") or p.get("era") or p["n"] in PLAYER_TAG_FIXES
    ]

    content = {
        "version": 1,
        "season": SEASON,
        "title": "Y80 League History",
        "source": "data/y80 (eras.json, super_bowls.json, league-history.md, players.json)",
        "eras": eras,
        "superBowls": super_bowls,
        "storylines": storylines,
        "rivalries": rivalries,
        "lineages": lineages,
        "snubs": snubs,
        "outsiders": outsiders,
        "openQuestions": open_questions,
        "playerNotes": player_notes,
        # Hall of Fame classes shared by every device (keys "POS:Name"); newer classes last.
        "hofClasses": HOF_CLASSES,
        # Head coach card + season-by-season history from the staff screen (optional)
        "coach": load("coach.json") if os.path.exists(os.path.join(SRC, "coach.json")) else None,
        "speeches": SPEECHES,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(content, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"Wrote {os.path.relpath(OUT, ROOT)}: {len(eras)} eras, {len(super_bowls)} Super Bowls, "
          f"{len(storylines)} storylines, {len(rivalries)} rivalries, {len(lineages)} lineages, {len(snubs)} snubs")


if __name__ == "__main__":
    main()
