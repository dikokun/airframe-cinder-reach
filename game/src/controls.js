// Keyboard controls: a held-key set mapped to a flight input each frame.
// Pitch/roll are rates toward a target attitude, throttle is a held position,
// flaps and gear are latching keys. The autopilot returns the same shape, so
// the model never knows whose hands are on the stick.

export function createControls() {
  const held = new Set();
  const state = { throttle: 0, flaps: 0, gearDown: true };

  function onKey(down) {
    return (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (down) {
        if (k === 'f') state.flaps = (state.flaps + 1) % 3;
        if (k === 'g') state.gearDown = !state.gearDown;
        held.add(k);
      } else {
        held.delete(k);
      }
    };
  }
  const down = onKey(true);
  const up = onKey(false);
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);

  return {
    state,
    sample(dt) {
      if (held.has('q')) state.throttle = Math.min(1, state.throttle + dt * 0.55);
      if (held.has('e')) state.throttle = Math.max(0, state.throttle - dt * 0.55);
      if (held.has('z')) state.throttle = 1;
      if (held.has('x')) state.throttle = 0;
      return {
        throttle: state.throttle,
        pitch: (held.has('arrowdown') || held.has('s') ? 1 : 0) + (held.has('arrowup') || held.has('w') ? -1 : 0),
        roll: (held.has('arrowright') || held.has('d') ? 1 : 0) + (held.has('arrowleft') || held.has('a') ? -1 : 0),
        flaps: state.flaps,
        gearDown: state.gearDown,
        brake: held.has(' '),
      };
    },
    setThrottle(v) { state.throttle = v; },
    dispose() {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    },
  };
}

export const KEY_HELP = 'W/S pitch · A/D roll · Q/E throttle · Z full · X cut · F flaps · G gear · Space brake';
