/* ============================================================
   IronRank exercise database
   ------------------------------------------------------------
   Each exercise:
     id        slug (auto from name)
     name
     equip     barbell | dumbbell | machine | cable | smith |
               bodyweight | kettlebell | band | cardio | other
     type      'w'  = external weight x reps
               'bw' = bodyweight reps (optional added weight)
               't'  = timed hold / carry (seconds)
               'c'  = cardio (minutes + optional km)
     p         primary muscles   (full XP credit)
     s         secondary muscles (half XP credit)
     std       strength standards (male base, female adjusted
               in standards.js):
                 {w:[5]} 1RM-to-bodyweight ratios  B/N/I/A/E
                 {r:[5]} strict reps               B/N/I/A/E
                 {t:[5]} seconds held              B/N/I/A/E
               null = no rank (tracked by volume only)
   ============================================================ */

const MUSCLES = {
  chest:       { name: 'Chest',       group: 'Push'  },
  shoulders:   { name: 'Shoulders',   group: 'Push'  },
  traps:       { name: 'Traps',       group: 'Pull'  },
  biceps:      { name: 'Biceps',      group: 'Pull'  },
  triceps:     { name: 'Triceps',     group: 'Push'  },
  forearms:    { name: 'Forearms',    group: 'Pull'  },
  abs:         { name: 'Abs',         group: 'Core'  },
  obliques:    { name: 'Obliques',    group: 'Core'  },
  lats:        { name: 'Lats',        group: 'Pull'  },
  'upper-back':{ name: 'Upper Back',  group: 'Pull'  },
  'lower-back':{ name: 'Lower Back',  group: 'Core'  },
  glutes:      { name: 'Glutes',      group: 'Legs'  },
  quads:       { name: 'Quads',       group: 'Legs'  },
  hamstrings:  { name: 'Hamstrings',  group: 'Legs'  },
  adductors:   { name: 'Adductors',   group: 'Legs'  },
  calves:      { name: 'Calves',      group: 'Legs'  },
  neck:        { name: 'Neck',        group: 'Other' },
  cardio:      { name: 'Cardio',      group: 'Cardio'}
};

const EQUIPMENT = ['barbell','dumbbell','machine','cable','smith','bodyweight','kettlebell','band','cardio','other'];

/* Helper: derive 5 thresholds from an elite bodyweight ratio */
function W(elite) {
  return { w: [0.25, 0.40, 0.55, 0.75, 1.0].map(f => +(f * elite).toFixed(2)) };
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const _RAW = [
/* ---------------- CHEST ---------------- */
['Barbell Bench Press','barbell','w',['chest'],['triceps','shoulders'],{w:[0.50,0.75,1.00,1.50,2.00]}],
['Incline Barbell Bench Press','barbell','w',['chest'],['shoulders','triceps'],{w:[0.45,0.65,0.90,1.30,1.70]}],
['Decline Barbell Bench Press','barbell','w',['chest'],['triceps'],{w:[0.50,0.80,1.05,1.55,2.05]}],
['Barbell Floor Press','barbell','w',['chest'],['triceps'],W(1.7)],
['Dumbbell Bench Press','dumbbell','w',['chest'],['triceps','shoulders'],{w:[0.20,0.35,0.50,0.70,0.90]}],
['Incline Dumbbell Press','dumbbell','w',['chest'],['shoulders','triceps'],{w:[0.175,0.30,0.45,0.62,0.80]}],
['Decline Dumbbell Press','dumbbell','w',['chest'],['triceps'],W(0.9)],
['Dumbbell Fly','dumbbell','w',['chest'],['shoulders'],W(0.55)],
['Incline Dumbbell Fly','dumbbell','w',['chest'],['shoulders'],W(0.5)],
['Cable Fly (Mid)','cable','w',['chest'],['shoulders'],W(0.45)],
['Low-to-High Cable Fly','cable','w',['chest'],['shoulders'],W(0.4)],
['High-to-Low Cable Fly','cable','w',['chest'],['shoulders'],W(0.45)],
['Pec Deck Fly','machine','w',['chest'],[],W(1.1)],
['Machine Chest Press','machine','w',['chest'],['triceps','shoulders'],W(1.5)],
['Incline Machine Press','machine','w',['chest'],['shoulders','triceps'],W(1.3)],
['Smith Machine Bench Press','smith','w',['chest'],['triceps','shoulders'],W(1.9)],
['Smith Machine Incline Press','smith','w',['chest'],['shoulders','triceps'],W(1.6)],
['Push-Up','bodyweight','bw',['chest'],['triceps','shoulders','abs'],{r:[10,20,35,55,80]}],
['Wide-Grip Push-Up','bodyweight','bw',['chest'],['shoulders'],{r:[8,18,30,50,70]}],
['Deficit Push-Up','bodyweight','bw',['chest'],['triceps','shoulders'],{r:[6,15,28,45,65]}],
['Weighted Push-Up','bodyweight','bw',['chest'],['triceps','shoulders'],{r:[8,15,25,40,60]}],
['Ring Push-Up','bodyweight','bw',['chest'],['triceps','abs'],{r:[5,12,22,38,55]}],
['Chest Dip','bodyweight','bw',['chest'],['triceps','shoulders'],{r:[3,8,15,25,40]}],
['Landmine Press','barbell','w',['chest','shoulders'],['triceps'],W(0.8)],
['Svend Press','other','w',['chest'],['shoulders'],W(0.3)],
['Guillotine Press','barbell','w',['chest'],['shoulders'],W(1.5)],

/* ---------------- BACK / LATS ---------------- */
['Conventional Deadlift','barbell','w',['lower-back','glutes','hamstrings'],['lats','traps','forearms','quads'],{w:[1.00,1.50,2.00,2.50,3.00]}],
['Sumo Deadlift','barbell','w',['glutes','quads','adductors'],['lower-back','hamstrings','traps'],{w:[1.00,1.50,2.00,2.50,3.00]}],
['Romanian Deadlift','barbell','w',['hamstrings','glutes'],['lower-back','forearms'],{w:[0.75,1.10,1.50,2.00,2.50]}],
['Stiff-Leg Deadlift','barbell','w',['hamstrings'],['lower-back','glutes'],W(2.3)],
['Snatch-Grip Deadlift','barbell','w',['lower-back','traps'],['glutes','hamstrings','forearms'],W(2.5)],
['Trap Bar Deadlift','other','w',['quads','glutes','lower-back'],['traps','forearms','hamstrings'],{w:[1.10,1.60,2.10,2.60,3.10]}],
['Rack Pull','barbell','w',['lower-back','traps'],['glutes','forearms'],W(3.3)],
['Barbell Row','barbell','w',['lats','upper-back'],['biceps','lower-back','forearms'],{w:[0.50,0.75,1.00,1.30,1.60]}],
['Pendlay Row','barbell','w',['lats','upper-back'],['biceps','lower-back'],{w:[0.50,0.75,1.00,1.30,1.60]}],
['Yates Row','barbell','w',['lats','upper-back'],['biceps','traps'],W(1.7)],
['T-Bar Row','other','w',['lats','upper-back'],['biceps','lower-back'],W(1.6)],
['Meadows Row','barbell','w',['lats','upper-back'],['biceps'],W(0.7)],
['One-Arm Dumbbell Row','dumbbell','w',['lats','upper-back'],['biceps','forearms'],{w:[0.20,0.35,0.50,0.70,0.90]}],
['Chest-Supported Dumbbell Row','dumbbell','w',['upper-back','lats'],['biceps'],W(0.8)],
['Seal Row','barbell','w',['upper-back','lats'],['biceps'],W(1.2)],
['Machine Row','machine','w',['upper-back','lats'],['biceps'],W(1.5)],
['Seated Cable Row (Close Grip)','cable','w',['lats','upper-back'],['biceps','forearms'],{w:[0.40,0.65,0.90,1.20,1.50]}],
['Seated Cable Row (Wide Grip)','cable','w',['upper-back','lats'],['biceps','shoulders'],W(1.4)],
['Single-Arm Cable Row','cable','w',['lats'],['biceps'],W(0.7)],
['Pull-Up','bodyweight','bw',['lats'],['biceps','upper-back','forearms'],{r:[1,5,10,15,25]}],
['Chin-Up','bodyweight','bw',['lats','biceps'],['upper-back','forearms'],{r:[1,6,12,18,28]}],
['Neutral-Grip Pull-Up','bodyweight','bw',['lats'],['biceps','upper-back'],{r:[1,6,11,16,26]}],
['Weighted Pull-Up','bodyweight','bw',['lats'],['biceps','upper-back'],{r:[1,4,8,12,20]}],
['Wide-Grip Pull-Up','bodyweight','bw',['lats'],['upper-back','biceps'],{r:[1,4,8,13,22]}],
['Inverted Row','bodyweight','bw',['upper-back','lats'],['biceps'],{r:[5,12,20,32,45]}],
['Lat Pulldown (Wide)','cable','w',['lats'],['biceps','upper-back'],{w:[0.40,0.60,0.80,1.05,1.30]}],
['Lat Pulldown (Close Grip)','cable','w',['lats'],['biceps'],{w:[0.42,0.62,0.85,1.10,1.35]}],
['Lat Pulldown (Reverse Grip)','cable','w',['lats','biceps'],[],W(1.3)],
['Machine Pulldown','machine','w',['lats'],['biceps'],W(1.4)],
['Straight-Arm Pulldown','cable','w',['lats'],['triceps'],W(0.8)],
['Cable Pullover','cable','w',['lats'],['chest','triceps'],W(0.8)],
['Dumbbell Pullover','dumbbell','w',['lats','chest'],['triceps'],W(0.6)],
['Back Extension','bodyweight','bw',['lower-back','glutes'],['hamstrings'],{r:[8,15,25,40,60]}],
['Good Morning','barbell','w',['hamstrings','lower-back'],['glutes'],{w:[0.30,0.50,0.75,1.00,1.30]}],
['Barbell Shrug','barbell','w',['traps'],['forearms'],{w:[0.55,0.90,1.30,1.75,2.20]}],
['Dumbbell Shrug','dumbbell','w',['traps'],['forearms'],W(1.0)],
['Cable Shrug','cable','w',['traps'],[],W(1.8)],
['Face Pull','cable','w',['shoulders','upper-back'],['traps'],W(0.5)],
['Reverse Pec Deck','machine','w',['shoulders','upper-back'],[],W(0.9)],

/* ---------------- SHOULDERS ---------------- */
['Overhead Press','barbell','w',['shoulders'],['triceps','traps','abs'],{w:[0.35,0.55,0.80,1.05,1.30]}],
['Seated Barbell Press','barbell','w',['shoulders'],['triceps'],{w:[0.35,0.55,0.78,1.02,1.25]}],
['Push Press','barbell','w',['shoulders'],['triceps','quads'],{w:[0.45,0.70,0.95,1.25,1.55]}],
['Behind-the-Neck Press','barbell','w',['shoulders'],['triceps','traps'],W(1.1)],
['Dumbbell Shoulder Press','dumbbell','w',['shoulders'],['triceps'],{w:[0.125,0.22,0.35,0.50,0.65]}],
['Seated Dumbbell Press','dumbbell','w',['shoulders'],['triceps'],{w:[0.125,0.22,0.35,0.50,0.65]}],
['Arnold Press','dumbbell','w',['shoulders'],['triceps'],W(0.6)],
['Machine Shoulder Press','machine','w',['shoulders'],['triceps'],W(1.1)],
['Smith Machine Shoulder Press','smith','w',['shoulders'],['triceps'],W(1.2)],
['Dumbbell Lateral Raise','dumbbell','w',['shoulders'],['traps'],{w:[0.05,0.11,0.18,0.27,0.36]}],
['Cable Lateral Raise','cable','w',['shoulders'],[],W(0.25)],
['Machine Lateral Raise','machine','w',['shoulders'],[],W(0.7)],
['Dumbbell Front Raise','dumbbell','w',['shoulders'],['chest'],W(0.3)],
['Plate Front Raise','other','w',['shoulders'],['chest'],W(0.35)],
['Cable Front Raise','cable','w',['shoulders'],[],W(0.28)],
['Dumbbell Rear Delt Fly','dumbbell','w',['shoulders','upper-back'],[],W(0.28)],
['Cable Rear Delt Fly','cable','w',['shoulders','upper-back'],[],W(0.22)],
['Barbell Upright Row','barbell','w',['shoulders','traps'],['biceps'],W(1.0)],
['Cable Upright Row','cable','w',['shoulders','traps'],['biceps'],W(0.9)],
['Handstand Push-Up','bodyweight','bw',['shoulders'],['triceps','traps'],{r:[1,3,8,15,25]}],
['Pike Push-Up','bodyweight','bw',['shoulders'],['triceps','chest'],{r:[3,8,15,25,40]}],
['Cuban Press','dumbbell','w',['shoulders'],['traps'],W(0.2)],
['Bradford Press','barbell','w',['shoulders'],['triceps'],W(0.8)],

/* ---------------- BICEPS ---------------- */
['Barbell Curl','barbell','w',['biceps'],['forearms'],{w:[0.25,0.40,0.60,0.80,1.00]}],
['EZ-Bar Curl','barbell','w',['biceps'],['forearms'],{w:[0.25,0.40,0.60,0.80,1.00]}],
['Dumbbell Curl','dumbbell','w',['biceps'],['forearms'],{w:[0.075,0.14,0.25,0.36,0.48]}],
['Alternating Dumbbell Curl','dumbbell','w',['biceps'],['forearms'],W(0.48)],
['Hammer Curl','dumbbell','w',['biceps','forearms'],[],{w:[0.10,0.17,0.28,0.40,0.52]}],
['Incline Dumbbell Curl','dumbbell','w',['biceps'],[],W(0.4)],
['Preacher Curl (EZ-Bar)','barbell','w',['biceps'],['forearms'],W(0.85)],
['Preacher Curl (Dumbbell)','dumbbell','w',['biceps'],[],W(0.4)],
['Machine Preacher Curl','machine','w',['biceps'],[],W(0.9)],
['Concentration Curl','dumbbell','w',['biceps'],[],W(0.38)],
['Cable Curl','cable','w',['biceps'],['forearms'],W(0.85)],
['Bayesian Cable Curl','cable','w',['biceps'],[],W(0.4)],
['Spider Curl','dumbbell','w',['biceps'],[],W(0.35)],
['Drag Curl','barbell','w',['biceps'],['forearms'],W(0.75)],
['Zottman Curl','dumbbell','w',['biceps','forearms'],[],W(0.38)],
['Reverse Barbell Curl','barbell','w',['forearms','biceps'],[],W(0.7)],
['Chin-Up Hold','bodyweight','t',['biceps','lats'],['forearms'],{t:[10,25,45,75,120]}],

/* ---------------- TRICEPS ---------------- */
['Close-Grip Bench Press','barbell','w',['triceps'],['chest','shoulders'],{w:[0.45,0.70,0.95,1.35,1.80]}],
['Skull Crusher (EZ-Bar)','barbell','w',['triceps'],[],{w:[0.20,0.35,0.50,0.70,0.90]}],
['Dumbbell Skull Crusher','dumbbell','w',['triceps'],[],W(0.4)],
['Overhead Dumbbell Extension','dumbbell','w',['triceps'],[],W(0.75)],
['Overhead Cable Extension','cable','w',['triceps'],[],W(0.75)],
['Cable Pushdown (Rope)','cable','w',['triceps'],[],{w:[0.20,0.35,0.55,0.80,1.05]}],
['Cable Pushdown (Bar)','cable','w',['triceps'],[],{w:[0.22,0.38,0.60,0.85,1.10]}],
['Reverse-Grip Pushdown','cable','w',['triceps'],['forearms'],W(0.9)],
['Dumbbell Kickback','dumbbell','w',['triceps'],[],W(0.28)],
['Triceps Dip','bodyweight','bw',['triceps'],['chest','shoulders'],{r:[3,8,15,25,40]}],
['Weighted Dip','bodyweight','bw',['triceps','chest'],['shoulders'],{r:[3,7,13,22,35]}],
['Bench Dip','bodyweight','bw',['triceps'],['shoulders'],{r:[8,15,28,45,65]}],
['Diamond Push-Up','bodyweight','bw',['triceps'],['chest','shoulders'],{r:[5,12,25,40,60]}],
['JM Press','barbell','w',['triceps'],['chest'],W(1.1)],
['Machine Triceps Extension','machine','w',['triceps'],[],W(1.0)],
['French Press','barbell','w',['triceps'],[],W(0.8)],

/* ---------------- FOREARMS / GRIP ---------------- */
['Barbell Wrist Curl','barbell','w',['forearms'],[],W(0.7)],
['Reverse Wrist Curl','barbell','w',['forearms'],[],W(0.4)],
['Behind-the-Back Wrist Curl','barbell','w',['forearms'],[],W(0.8)],
['Dumbbell Wrist Curl','dumbbell','w',['forearms'],[],W(0.3)],
["Farmer's Carry",'dumbbell','t',['forearms','traps'],['abs'],{t:[20,40,60,90,120]}],
['Plate Pinch Hold','other','t',['forearms'],[],{t:[10,20,35,55,80]}],
['Dead Hang','bodyweight','t',['forearms'],['lats','shoulders'],{t:[20,45,75,120,180]}],
['Wrist Roller','other','w',['forearms'],[],W(0.25)],

/* ---------------- QUADS / LEGS ---------------- */
['Back Squat','barbell','w',['quads','glutes'],['hamstrings','lower-back','abs','adductors'],{w:[0.75,1.00,1.50,2.00,2.50]}],
['Front Squat','barbell','w',['quads'],['glutes','abs','upper-back'],{w:[0.55,0.85,1.20,1.60,2.05]}],
['Box Squat','barbell','w',['quads','glutes'],['hamstrings','lower-back'],W(2.4)],
['Pause Squat','barbell','w',['quads','glutes'],['hamstrings','abs'],W(2.2)],
['Zercher Squat','barbell','w',['quads','glutes'],['abs','biceps','upper-back'],W(1.8)],
['Safety Bar Squat','other','w',['quads','glutes'],['upper-back','abs'],W(2.3)],
['Goblet Squat','dumbbell','w',['quads','glutes'],['abs'],W(0.9)],
['Smith Machine Squat','smith','w',['quads','glutes'],['hamstrings'],W(2.4)],
['Hack Squat (Machine)','machine','w',['quads'],['glutes'],{w:[0.70,1.10,1.60,2.20,2.80]}],
['Barbell Hack Squat','barbell','w',['quads'],['glutes','forearms'],W(1.6)],
['Leg Press','machine','w',['quads','glutes'],['hamstrings','adductors'],{w:[1.00,1.75,2.75,4.00,5.25]}],
['Single-Leg Press','machine','w',['quads','glutes'],['hamstrings'],W(2.6)],
['Leg Extension','machine','w',['quads'],[],{w:[0.35,0.60,0.90,1.25,1.60]}],
['Bulgarian Split Squat','dumbbell','w',['quads','glutes'],['hamstrings','adductors'],{w:[0.10,0.20,0.35,0.55,0.75]}],
['Barbell Split Squat','barbell','w',['quads','glutes'],['hamstrings'],W(1.3)],
['Walking Lunge','dumbbell','w',['quads','glutes'],['hamstrings','calves'],W(0.6)],
['Reverse Lunge','dumbbell','w',['quads','glutes'],['hamstrings'],W(0.6)],
['Barbell Lunge','barbell','w',['quads','glutes'],['hamstrings'],W(1.2)],
['Step-Up','dumbbell','w',['quads','glutes'],['calves'],W(0.55)],
['Pistol Squat','bodyweight','bw',['quads','glutes'],['abs','calves'],{r:[1,3,8,15,25]}],
['Sissy Squat','bodyweight','bw',['quads'],['abs'],{r:[3,8,15,25,40]}],
['Wall Sit','bodyweight','t',['quads'],['glutes'],{t:[30,60,100,150,240]}],
['Belt Squat','machine','w',['quads','glutes'],['adductors'],W(2.5)],
['Landmine Squat','barbell','w',['quads','glutes'],['abs'],W(1.2)],
['Bodyweight Squat','bodyweight','bw',['quads','glutes'],['hamstrings'],{r:[15,30,50,80,120]}],
['Jump Squat','bodyweight','bw',['quads','glutes'],['calves'],{r:[10,20,35,55,80]}],

/* ---------------- HAMSTRINGS / GLUTES ---------------- */
['Lying Leg Curl','machine','w',['hamstrings'],['calves'],{w:[0.25,0.45,0.70,1.00,1.30]}],
['Seated Leg Curl','machine','w',['hamstrings'],[],{w:[0.30,0.50,0.80,1.10,1.45]}],
['Standing Leg Curl','machine','w',['hamstrings'],[],W(0.6)],
['Nordic Hamstring Curl','bodyweight','bw',['hamstrings'],['glutes'],{r:[1,3,6,12,20]}],
['Glute-Ham Raise','bodyweight','bw',['hamstrings','glutes'],['lower-back'],{r:[1,5,10,18,30]}],
['Dumbbell Romanian Deadlift','dumbbell','w',['hamstrings','glutes'],['lower-back'],W(1.0)],
['Single-Leg Romanian Deadlift','dumbbell','w',['hamstrings','glutes'],['abs'],W(0.5)],
['Kettlebell Swing','kettlebell','w',['glutes','hamstrings'],['lower-back','shoulders'],{w:[0.15,0.25,0.40,0.55,0.75]}],
['Barbell Hip Thrust','barbell','w',['glutes'],['hamstrings','quads'],{w:[0.60,1.00,1.55,2.20,2.90]}],
['Machine Hip Thrust','machine','w',['glutes'],['hamstrings'],W(2.8)],
['Glute Bridge','barbell','w',['glutes'],['hamstrings'],W(2.2)],
['Single-Leg Glute Bridge','bodyweight','bw',['glutes'],['hamstrings'],{r:[8,15,25,40,60]}],
['Cable Pull-Through','cable','w',['glutes','hamstrings'],['lower-back'],W(1.1)],
['Cable Glute Kickback','cable','w',['glutes'],['hamstrings'],W(0.5)],
['Hip Abduction Machine','machine','w',['glutes'],[],W(1.3)],
['Hip Adduction Machine','machine','w',['adductors'],[],W(1.3)],
['Sumo Squat (Dumbbell)','dumbbell','w',['adductors','glutes'],['quads'],W(1.0)],
['Curtsy Lunge','dumbbell','w',['glutes','quads'],['adductors'],W(0.5)],
['Frog Pump','bodyweight','bw',['glutes'],[],{r:[15,30,50,75,110]}],
['Copenhagen Plank','bodyweight','t',['adductors'],['obliques'],{t:[10,20,35,55,80]}],

/* ---------------- CALVES ---------------- */
['Standing Calf Raise (Machine)','machine','w',['calves'],[],{w:[0.45,0.80,1.25,1.75,2.30]}],
['Smith Machine Calf Raise','smith','w',['calves'],[],W(2.2)],
['Seated Calf Raise','machine','w',['calves'],[],{w:[0.30,0.55,0.85,1.20,1.60]}],
['Leg Press Calf Raise','machine','w',['calves'],[],W(3.0)],
['Single-Leg Calf Raise','dumbbell','w',['calves'],[],W(0.6)],
['Donkey Calf Raise','machine','w',['calves'],[],W(2.5)],
['Bodyweight Calf Raise','bodyweight','bw',['calves'],[],{r:[15,30,50,75,110]}],

/* ---------------- ABS / CORE ---------------- */
['Crunch','bodyweight','bw',['abs'],[],{r:[10,25,45,75,110]}],
['Sit-Up','bodyweight','bw',['abs'],['obliques'],{r:[10,20,40,65,95]}],
['Decline Sit-Up','bodyweight','bw',['abs'],['obliques'],{r:[8,16,30,50,75]}],
['Weighted Sit-Up','other','w',['abs'],['obliques'],W(0.5)],
['Cable Crunch','cable','w',['abs'],[],{w:[0.25,0.45,0.70,1.00,1.30]}],
['Machine Crunch','machine','w',['abs'],[],W(1.2)],
['Hanging Leg Raise','bodyweight','bw',['abs'],['forearms','obliques'],{r:[3,8,15,25,40]}],
['Hanging Knee Raise','bodyweight','bw',['abs'],['forearms'],{r:[5,12,22,35,50]}],
['Lying Leg Raise','bodyweight','bw',['abs'],[],{r:[8,18,32,50,75]}],
['Toes-to-Bar','bodyweight','bw',['abs'],['lats','forearms'],{r:[1,5,12,20,35]}],
['Plank','bodyweight','t',['abs'],['obliques','lower-back'],{t:[30,60,120,210,300]}],
['Side Plank','bodyweight','t',['obliques'],['abs'],{t:[20,45,80,130,200]}],
['Ab Wheel Rollout','bodyweight','bw',['abs'],['lats','obliques'],{r:[3,8,15,25,40]}],
['Russian Twist','bodyweight','bw',['obliques'],['abs'],{r:[16,30,50,80,120]}],
['Cable Woodchopper','cable','w',['obliques'],['abs'],W(0.6)],
['Pallof Press','cable','w',['obliques','abs'],[],W(0.4)],
['Dragon Flag','bodyweight','bw',['abs'],['obliques','lats'],{r:[1,3,7,12,20]}],
['V-Up','bodyweight','bw',['abs'],[],{r:[6,14,25,40,60]}],
['Bicycle Crunch','bodyweight','bw',['abs','obliques'],[],{r:[16,30,55,85,130]}],
['Dead Bug','bodyweight','bw',['abs'],[],{r:[10,20,35,55,80]}],
['Mountain Climber','bodyweight','bw',['abs'],['quads','shoulders'],{r:[20,40,70,110,160]}],
['Landmine Rotation','barbell','w',['obliques'],['shoulders','abs'],W(0.5)],
['Dumbbell Side Bend','dumbbell','w',['obliques'],[],W(0.6)],
['L-Sit Hold','bodyweight','t',['abs'],['quads','triceps'],{t:[5,15,30,50,80]}],
['Suitcase Carry','dumbbell','t',['obliques','forearms'],['traps'],{t:[20,40,60,90,120]}],

/* ---------------- NECK ---------------- */
['Neck Curl (Plate)','other','w',['neck'],[],W(0.25)],
['Neck Extension (Plate)','other','w',['neck'],[],W(0.3)],
['Neck Harness Extension','other','w',['neck'],['traps'],W(0.35)],

/* ---------------- OLYMPIC / FULL BODY ---------------- */
['Power Clean','barbell','w',['traps','glutes','hamstrings'],['quads','shoulders','forearms'],{w:[0.50,0.80,1.10,1.45,1.80]}],
['Hang Clean','barbell','w',['traps','glutes'],['hamstrings','quads','shoulders'],W(1.7)],
['Clean & Jerk','barbell','w',['quads','glutes','shoulders'],['traps','triceps','hamstrings'],{w:[0.55,0.85,1.20,1.55,1.95]}],
['Snatch','barbell','w',['traps','glutes','shoulders'],['quads','hamstrings'],{w:[0.40,0.65,0.90,1.20,1.50]}],
['Clean & Press','barbell','w',['shoulders','traps'],['quads','glutes','triceps'],W(1.5)],
['Thruster','barbell','w',['quads','shoulders'],['glutes','triceps'],W(1.3)],
['Kettlebell Snatch','kettlebell','w',['shoulders','glutes'],['traps','hamstrings'],W(0.5)],
['Kettlebell Clean & Press','kettlebell','w',['shoulders','glutes'],['traps','quads'],W(0.55)],
['Turkish Get-Up','kettlebell','w',['shoulders','abs'],['glutes','obliques'],W(0.5)],
['Sled Push','other','w',['quads','glutes'],['calves','abs'],W(4.0)],
['Sled Pull','other','w',['hamstrings','upper-back'],['forearms','calves'],W(3.5)],
['Tire Flip','other','bw',['glutes','quads'],['lower-back','biceps','forearms'],null],
['Battle Ropes','other','t',['shoulders','abs'],['forearms','cardio'],{t:[20,40,70,110,180]}],
['Burpee','bodyweight','bw',['quads','chest'],['abs','shoulders','cardio'],{r:[8,15,30,50,75]}],
['Box Jump','bodyweight','bw',['quads','glutes'],['calves'],{r:[5,12,25,40,60]}],
['Broad Jump','bodyweight','bw',['quads','glutes'],['calves','hamstrings'],null],
['Muscle-Up','bodyweight','bw',['lats','triceps'],['biceps','chest','abs'],{r:[1,2,5,10,18]}],

/* ---------------- CARDIO ---------------- */
['Treadmill Run','cardio','c',['cardio'],['quads','calves','hamstrings'],null],
['Outdoor Run','cardio','c',['cardio'],['quads','calves','hamstrings'],null],
['Sprints','cardio','c',['cardio'],['quads','hamstrings','glutes','calves'],null],
['Incline Treadmill Walk','cardio','c',['cardio'],['calves','glutes'],null],
['Walking','cardio','c',['cardio'],['calves'],null],
['Stationary Bike','cardio','c',['cardio'],['quads'],null],
['Outdoor Cycling','cardio','c',['cardio'],['quads','calves'],null],
['Assault Bike','cardio','c',['cardio'],['quads','shoulders'],null],
['Rowing Machine','cardio','c',['cardio'],['lats','upper-back','quads','biceps'],null],
['Ski Erg','cardio','c',['cardio'],['lats','triceps','abs'],null],
['Elliptical','cardio','c',['cardio'],['quads','glutes'],null],
['Stair Climber','cardio','c',['cardio'],['quads','glutes','calves'],null],
['Jump Rope','cardio','c',['cardio'],['calves','forearms'],null],
['Swimming','cardio','c',['cardio'],['lats','shoulders','abs'],null],
['HIIT Session','cardio','c',['cardio'],['quads','abs'],null],
['Hiking','cardio','c',['cardio'],['quads','calves','glutes'],null],
];

const EXERCISES = _RAW.map(([name, equip, type, p, s, std]) => ({
  id: slug(name), name, equip, type, p, s, std
}));

const EXERCISES_BY_ID = Object.fromEntries(EXERCISES.map(e => [e.id, e]));
