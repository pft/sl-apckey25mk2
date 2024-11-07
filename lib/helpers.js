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
