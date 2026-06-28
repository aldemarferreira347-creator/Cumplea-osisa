import { init as initWelcome } from '../acts/welcome.js';
import { init as initSolarSystem, dispose as disposeSolarSystem } from '../acts/solar-system.js';
import { init as initStory } from '../acts/story.js';

const containers = {
  welcome: document.getElementById('act-welcome'),
  'solar-system': document.getElementById('act-solar-system'),
  story: document.getElementById('act-story'),
};

let currentState = null;

function hideAll() {
  for (const el of Object.values(containers)) {
    el.classList.remove('active');
    el.innerHTML = '';
  }
}

function transition(nextState, initFn) {
  if (currentState === 'solar-system') {
    disposeSolarSystem();
  }
  hideAll();
  currentState = nextState;
  containers[nextState].classList.add('active');
  // Defer one frame so the browser paints display:block before init()
  // reads clientWidth/clientHeight (otherwise they'd be 0).
  requestAnimationFrame(() => initFn(containers[nextState]));
}

export function goToWelcome() {
  transition('welcome', initWelcome);
}

export function goToSolarSystem() {
  transition('solar-system', initSolarSystem);
}

export function goToStory() {
  transition('story', initStory);
}
