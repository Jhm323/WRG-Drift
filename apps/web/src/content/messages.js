// Character-voice message bank. Each situation has 5 characters; each
// character has 5 rotating variants — pick randomly each time so it doesn't
// feel repetitive. {score} and {time} are interpolated at render time.
// No message ever references another player by name — every line is
// self-directed at the current player only.

export const TONE_LEVELS = ['professional', 'knightly', 'hypeMan', 'heckler', 'outlaw'];

export const TONE_LABELS = {
  professional: 'Professional',
  knightly: 'Knightly',
  hypeMan: 'Hype Man',
  heckler: 'Heckler',
  outlaw: 'Outlaw',
};

export const PR_MESSAGES = {
  professional: [
    'New personal best: {score}.',
    'Personal record achieved: {score} points.',
    'Your best score has been updated: {score}.',
    'New high mark set: {score} points.',
    'Personal best surpassed. New mark: {score}.',
  ],
  knightly: [
    'Well fought, good driver! A new record of {score} is thine!',
    'Huzzah! {score} points — a personal best worthy of song!',
    'Thou hast surpassed thyself! New best: {score}!',
    'A triumphant new record, {score}! The realm rejoices!',
    'By thy skill, a new best is set: {score} points!',
  ],
  hypeMan: [
    "OHHHH IT'S A NEW PERSONAL BEST, {score}, LET'S GOOO!!!",
    "NEW RECORD ALERT! {score} POINTS! THE CROWD IS ON ITS FEET!",
    "{score}!! THAT'S A PR, FOLKS! ABSOLUTELY ELECTRIC!",
    "PERSONAL BEST SMASHED! {score}! WHAT A DRIVE!",
    "{score} POINTS! NEW BEST! I AM LOSING MY MIND RIGHT NOW!",
  ],
  heckler: [
    "Oh, a new PR? {score}? If I say congrats, can we do something else?",
    "{score}, huh. and your still a turd. Congrats, I guess.",
    "New best of {score}. Don't let it go to your head. Too late.",
    "Wow, {score}. Did you practice, or was that an accident?",
    "PR unlocked: {score}. I'm shocked. Genuinely.",
  ],
  outlaw: [
    "F*ckin A! New PR, {score}! Let's ride!",
    "{score} and a new record. Hell Ya.",
    "NEW BEST. {score}. Somebody get this F*cker a trophy.",
    "PR SMASHED. {score}. Bet'chur ass.",
    "{score}! Hell yeah, new record, baby!",
  ],
};

export const NOT_PR_MESSAGES = {
  professional: [
    'Run ended. Final score: {score}.',
    'Score: {score}. Your best on this track remains higher.',
    'Final score recorded: {score}.',
    'Run complete. Score: {score}.',
    '{score} points this run.',
  ],
  knightly: [
    'A valiant effort, {score} points, though thy record stands unbeaten.',
    'Well ridden! {score} points, though not thy finest hour.',
    'Thy score is {score}. The record awaits another attempt.',
    '{score} points earned. Ride again, brave one!',
    'A respectable showing of {score}. Thy best remains beyond.',
  ],
  hypeMan: [
    "{score} POINTS! SOLID RUN! LET'S SEE THAT RECORD NEXT TIME!",
    "GOOD EFFORT, {score} POINTS! THE CROWD APPROVES!",
    "{score}! NOT BAD! NOT BAD AT ALL! RUN IT BACK!",
    "{score} POINTS ON THE BOARD! WARMING UP OUT THERE!",
    "SOLID {score}! THAT PR IS STILL WAITING FOR YOU!",
  ],
  heckler: [
    "{score}. Not your best, but hey, you tried.",
    "Solid-ish. {score}. Your PR is safe for now.",
    "{score}? That's a shame.",
    "That's a {score}. We've all had off days. Not like you, though.",
    "{score} points. welp. Should i call your mom now?",
  ],
  outlaw: [
    "{score}? That's rookie numbers. Run it back.",
    "Meh. {score}. Do better.",
    "{score} points. Your PR is laughing at you.",
    "That run was rough. {score}. Try again, champ.",
    "{score}. Not it. Send another lap.",
  ],
};

export const CRASH_MESSAGES = {
  professional: [
    'Crashed. Final score: {score} ({time}s survived).',
    'Run ended in a crash. Score: {score}.',
    'Collision detected. Final score: {score}.',
    'Off track. Final score: {score} ({time}s).',
    'Run terminated. Score: {score}.',
  ],
  knightly: [
    'Alas! Thou hast fallen! {score} points before thy defeat.',
    'A valiant crash! {score} points, {time} seconds of glory.',
    'Thou hast met the wall in battle. {score} points earned.',
    'Defeated, but not without honor. {score} points, brave one.',
    '{score} points before thy chariot met its end.',
  ],
  hypeMan: [
    "OHHH HE'S DOWN! {score} POINTS BEFORE THE CRASH! WHAT A RIDE!",
    "AND THAT'S A CRASH! {score} POINTS ON THE BOARD THOUGH!",
    "{score} POINTS BEFORE THE WIPEOUT! THIS CROWD IS LOVING IT!",
    "DOWN GOES THE DRIVER! {score} POINTS, {time} SECONDS OF CHAOS!",
    "CRASHED OUT AT {score}! STILL A HECK OF A SHOW!",
  ],
  heckler: [
    "Well that was ugly. {score}, though.",
    "So sad. {score} points.",
    "Physics: 1, You: 0. {score} points.",
    "Bold driving choice. {score} points and the wall.",
    "{score} points, then the wall said hello.",
  ],
  outlaw: [
    "YARD SALE. {score} points before you ate dirt.",
    "Crashed and burned. {score}. F*ckin embarrassing.",
    "Sent it straight into the wall. {score}. Nice.",
    "{score} points and a total wipeout. Send it again.",
    "Absolute carnage. {score} points before the crash.",
  ],
};

export const PRE_START_HINT = {
  professional: [
    'Hold Left / Right to steer. Press either key to begin.',
    'Use the arrow keys to steer. Press one to start the run.',
    'Steering: Left / Right arrows. Press a key to begin.',
    'Press Left or Right to begin. Hold to steer.',
    'Arrow keys control steering. Press to start.',
  ],
  knightly: [
    'Hold ← or → to steer thy chariot. Press one to begin thy quest!',
    'Thy steed awaits! Hold ← / → to drift into glory!',
    'Press ← or → to embark upon thy journey!',
    'Steer with ← / →, brave driver. Thy adventure begins!',
    'Hold ← or → to command thy vehicle into battle!',
  ],
  hypeMan: [
    "HOLD ← OR → TO DRIFT! LET'S GET THIS SHOW STARTED!",
    "PRESS ← OR → WHENEVER YOU'RE READY! LET'S GOOO!",
    "ARROW KEYS TO STEER! THE CROWD IS WAITING, LET'S RIDE!",
    "HOLD ← / → TO DRIFT! TIME TO PUT ON A SHOW!",
    "PRESS A KEY! LET'S SEE WHAT YOU'VE GOT OUT THERE!",
  ],
  heckler: [
    '← / → to steer. Try not to embarrass yourself.',
    'Hold ← / → to drift. Good luck with that.',
    'Arrow keys steer the car. Revolutionary, I know.',
    '← / → to drift. Try to stay on the track this time.',
    'Press ← or → to start. No pressure.',
  ],
  outlaw: [
    "← / → to drift. Don't crash. (You will.)",
    'Hold ← / → let that sh*t rip.',
    "Arrow keys steer this beast. Go get 'em.",
    "← / → to drift. Just drive, ya winus.",
    'Hit ← or → and let\'s go. You will eat dirt and you will like it.',
  ],
};
