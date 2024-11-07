// --------------------------------------------------------------------------
//  Helper class to handle knobs' speed
// --------------------------------------------------------------------------
export class KnobSpeedControl {
  _knobs_ease = [];
  constructor(steps_normal = 3, steps_shifted = 8) {
    this._steps_normal = steps_normal;
    this._steps_shifted = steps_shifted;
    this._knobs_ease = {};
  }
  feed(ccnum, ccval, is_shifted = false) {
    const delta = ccval < 64 ? ccval : ccval - 128,
      steps = is_shifted ? this._steps_shifted : this._steps_normal;
    let count = this._knobs_ease[ccnum] || 0;

    if ((delta < 0 && count > 0) || (delta > 0 && count < 0)) {
      count = 0;
    }
    count += delta;

    if (Math.abs(count) < steps) {
      this._knobs_ease[ccnum] = count;
      return;
    }
    this._knobs_ease[ccnum] = 0;
    return delta;
  }
}

const PT_BOLD_TIME = 0.3 * 1000;
const EV_NOTE_ON = 0x09,
  EV_NOTE_OFF = 0x08,
  EV_CC = 0x0b;

export class ButtonAutoLatch {
  _hits = {};
  feed(note, evtype) {
    const last = this._hits[note];
    const now = performance.now();
    // If note_on, return true;
    if (evtype === EV_NOTE_ON) {
      if (last) {
        delete this._hits[note];
        return false;
      }
      // Turn on
      this._hits[note] = now;
      return true;
    }
    if (evtype === EV_NOTE_OFF) {
      if (!this._hits[note]) return false;
      else {
        if (now - last < PT_BOLD_TIME) {
          return true;
          // leave on
        } else {
          delete this._hits[note];
          return false;
          // turn off
        }
      }
    }
    throw "ButtonAutoLatch only meant for NOTE_ON and NOTE_OFF events";
  }
}

// function cc_change(self, ccnum, ccval) {
//     const delta = self._knobs_ease.feed(ccnum, ccval, self._is_shifted)
//     if (delta === undefined) return;

// const zynpot = {
//             KNOB_LAYER: 0,
//             KNOB_BACK: 1,
//             KNOB_SNAPSHOT: 2,
//             KNOB_SELECT: 3
//         }.get(ccnum, None)
//         if zynpot is None:
//             return

//         self._state_manager.send_cuia("ZYNPOT", [zynpot, delta]
//                                      )
// }

export const cycle = (from, to, cur) => {
    const delta0 = -from;
    const from0 = from + delta0;
    const to0 = to + delta0;
    const cur0 = cur + delta0;
    const newVal0 = (cur0 + 1) % (to0 + 1);
    return newVal0 - delta0;
};

// console.log(cycle(-3,1,-2), -1);
// console.log(cycle(-3,1,0), 1);
// console.log(cycle(-3,1,1), -3);
// console.log(cycle(-3,1,-3), -2);
// console.log(cycle(-3,3,2), 3);
// console.log(cycle(-3,3,3), -3);
//console.log(cycle(-3,3,-4), -3);
