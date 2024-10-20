import osc from "osc";
import midi from "midi";
import { createStore } from "redux";
import {
  BUTTONS,
  SL_STATES,
  LED_BRIGHT_100,
  LED_BRIGHT_50,
  LED_BRIGHT_25,
  LED_BRIGHT_10,
  COLOR_DARK_GREEN,
  COLOR_ORANGE,
  COLOR_GREEN,
  COLOR_RED,
  COLOR_WHITE,
  COLOR_BLUE,
  COLOR_LIME,
} from "./consts.js";
import * as R from "ramda";

let loopcount = 0;

let shifted = false;
let undoing = false;
let redoing = false;
let force_alt1 = false;
let set_syncs = false;
let dosolo = false;
let domute = false;
let loopoffset = 0;

const range = "[0-99]";

const trackStartPad = (track) => (4 - track) * 8;
const padTrack = (pad) => [4, 3, 2, 1, 0].indexOf(Math.floor(pad / 8));
const shiftedTrack = (track, offset) => track - offset;
function reducer(state = { tracks: [] }, action) {
  switch (action.type) {
    case "track":
      return onUpdateTrack(action)(state);
    default:
      return state;
  }
}

const shiftUp = () => {
  const max = 0;
  loopoffset = Math.min(loopoffset + 1, max);
  renderAllPads();
};

const shiftDown = () => {
  const min = Math.min(0, 5 - loopcount);
  loopoffset = Math.max(loopoffset - 1, min);
  renderAllPads();
};

let store = createStore(reducer);

// Set up a new output.
const output = new midi.Output();

// Count the available output ports.
console.log("count", output.getPortCount());

// Get the name of a specified output port.
console.log("first port name", output.getPortName(0));

// Open the first available output port.
output.openPort(0);

// Set up a new input.
const input = new midi.Input();

input.openVirtualPort("SooperLooperAkai");
// Count the available input ports.
input.getPortCount();

// Get the name of a specified input port.
input.getPortName(1);

// Configure a callback.
const onMIDIMessage = (_deltaTime, message) => {
  // The message is an array of numbers corresponding to the MIDI bytes:
  //   [status, data1, data2]
  // https://www.cs.cf.ac.uk/Dave/Multimedia/node158.html has some helpful
  // information interpreting the messages.
  //  console.log(`m: ${message} d: ${deltaTime}`);
  const evtype = (message[0] >> 4) & 0x0f;
  const button = message[1];

  // if (evtype === EV_NOTE_ON) {
  //   console.log("Note on!", button);
  // }

  // if (evtype === EV_NOTE_OFF) {
  //   console.log("Note off!");
  // }

  // if (evtype === EV_CC) {
  //   console.log("CC!");
  // }
  // console.log(button, BUTTONS.BTN_PAD_START);
  if (
    evtype === EV_NOTE_ON &&
    button >= BUTTONS.BTN_PAD_START &&
    button <= BUTTONS.BTN_PAD_END
  ) {
    const pad = button;
    const track = shiftedTrack(padTrack(pad), loopoffset);
    const numpad = pad % 8;
    const stateTrack = R.path(["tracks", track], store.getState());
    if (dosolo) {
      justSend(`/sl/${track}/hit`, { type: "s", value: "solo" });
      return;
    }
    if (domute) {
      justSend(`/sl/${track}/hit`, { type: "s", value: "mute" });
      return;
    }
    if (set_syncs) {
      if (numpad === 0) {
        justSend(
          `/sl/${track}/set`,
          { type: "s", value: "sync" },
          { type: "f", value: Number(!stateTrack["sync"]) }
        );
      }
      if (numpad === 1) {
        justSend(
          `/sl/${track}/set`,
          { type: "s", value: "relative_sync" },
          { type: "f", value: Number(!stateTrack["relative_sync"]) }
        );
      }
      if (numpad === 2) {
        // NOTE: it seems just loop 1's setting is used for all
        justSend(
          `/sl/${track}/set`,
          { type: "s", value: "quantize" },
          { type: "f", value: (Number(stateTrack["quantize"]) + 1) % 4 }
        );
      }
      if (numpad === 3) {
        justSend(
          `/sl/${track}/set`,
          { type: "s", value: "playback_sync" },
          { type: "f", value: Number(!stateTrack["playback_sync"]) }
        );
      }
      if (numpad === 4) {
        justSend(
          `/sl/${track}/set`,
          { type: "s", value: "mute_quantized" },
          { type: "f", value: Number(!stateTrack["mute_quantized"]) }
        );
      }
      return;
    }
    if (numpad === 0) {
      if (
        R.propOr(-1, "state", stateTrack) < 2 || // Off or undefined
        (!force_alt1 && R.prop("state", stateTrack) === 2) || // Recording sans force => play
        (force_alt1 && R.prop("state", stateTrack) !== 2) // Not recording, having data, but forced
      ) {
        justSend(`/sl/${track}/hit`, { type: "s", value: "record" });
      } else {
        justSend(`/sl/${track}/hit`, { type: "s", value: "overdub" });
      }
    }
    if (numpad === 1) {
      justSend(`/sl/${track}/hit`, { type: "s", value: "multiply" });
      return;
    }
    if (numpad === 2) {
      if (undoing) justSend(`/sl/${track}/hit`, { type: "s", value: "undo" });
      else justSend(`/sl/${track}/hit`, { type: "s", value: "insert" });
      return;
    }
    if (numpad === 3) {
      if (redoing) justSend(`/sl/${track}/hit`, { type: "s", value: "redo" });
      else justSend(`/sl/${track}/hit`, { type: "s", value: "replace" });
      return;
    }
    if (numpad === 4) {
      justSend(`/sl/${track}/hit`, { type: "s", value: "substitute" });
    }
    if (numpad === 5) {
      justSend(`/sl/${track}/hit`, { type: "s", value: "oneshot" });
    }
    if (numpad === 6) {
      justSend(`/sl/${track}/hit`, { type: "s", value: "trigger" });
    }
    if (numpad === 7) {
      justSend(`/sl/${track}/hit`, { type: "s", value: "pause" });
    }
    return;
  }
  if (evtype === EV_NOTE_ON || evtype === EV_NOTE_OFF) {
    if (button === BUTTONS.BTN_SHIFT) {
      console.log("shifted");
      shifted = evtype === EV_NOTE_ON;
      return;
    }
    if (button === BUTTONS.BTN_UNDO) {
      undoing = evtype === EV_NOTE_ON;
      return;
    }
    if (button === BUTTONS.BTN_REDO) {
      redoing = evtype === EV_NOTE_ON;
      return;
    }
    if (evtype === EV_NOTE_ON && button === BUTTONS.BTN_TRACK_1) {
      if (evtype === EV_NOTE_ON && (shifted || set_syncs)) {
        shiftUp();
        return;
      }
      force_alt1 = evtype === EV_NOTE_ON;
      return;
    }
    if (button === BUTTONS.BTN_TRACK_2) {
      if (evtype === EV_NOTE_ON && (shifted || set_syncs)) {
        shiftDown();
        return;
      }
      force_alt1 = evtype === EV_NOTE_ON;
      return;
    }
    if (button === BUTTONS.BTN_SOFT_KEY_SOLO) {
      dosolo = evtype === EV_NOTE_ON;
      return;
    }
    if (button === BUTTONS.BTN_SOFT_KEY_MUTE) {
      domute = evtype === EV_NOTE_ON;
      return;
    }
    if (button === BUTTONS.BTN_SOFT_KEY_REC_ARM) {
      set_syncs = evtype === EV_NOTE_ON;
      return;
    }
  }
};

input.on("message", onMIDIMessage);

// Open the first available input port.
//input.openPort(1);

// Sysex, timing, and active sensing messages are ignored
// by default. To enable these message types, pass false for
// the appropriate type in the function below.
// Order: (Sysex, Timing, Active Sensing)
// For example if you want to receive only MIDI Clock beats
// you should use
// input.ignoreTypes(true, false, true)
input.ignoreTypes(false, false, false);

const OSC_SL_HOST = "zynthian.local";
const OSC_SL_PORT = 9951;

const OSC_HOST = "192.168.178.101";
const OSC_PORT = 9952;

var udpPort = new osc.UDPPort({
  localAddress: OSC_HOST,
  localPort: OSC_PORT,
  metadata: true,
});

const justSend = (address, ...args) => {
  const message = {
    address,
    args: [...args],
  };
  //console.log(message);
  udpPort.send(message, OSC_SL_HOST, OSC_SL_PORT);
};

const requestFeedback = (address, path, ...args) => {
  const message = {
    address,
    args: [
      ...args,
      {
        type: "s",
        value: `osc.udp://${OSC_HOST}:${OSC_PORT}`,
      },
      {
        type: "s",
        value: path,
      },
    ],
  };
  //console.log(message);
  udpPort.send(message, OSC_SL_HOST, OSC_SL_PORT);
};

const ctrls = [
  "feedback",
  "input_gain",
  "sync",
  "relative_sync",
  "quantize",
  "playback_sync",
  "mute_quantized",
];

const auto_ctrls = ["state", "next_state", "loop_pos", "loop_len"];

const unregister_update = () => {
  ctrls.forEach((ctrl) => {
    requestFeedback(`/sl/${range}/unregister_update`, "/update", {
      type: "s",
      value: ctrl,
    });
  });
  auto_ctrls.forEach((ctrl) => {
    requestFeedback(`/sl/${range}/unregister_auto_update`, "/update", {
      type: "s",
      value: ctrl,
    });
  });
};

const register_update = () => {
  ctrls.forEach((ctrl) => {
    requestFeedback(`/sl/${range}/register_update`, "/update", {
      type: "s",
      value: ctrl,
    });
  });
  auto_ctrls.forEach((ctrl) => {
    requestFeedback(
      `/sl/${range}/register_auto_update`,
      "/update",
      {
        type: "s",
        value: ctrl,
      },
      {
        type: "i",
        value: 100,
      }
    );
  });
  requestFeedback("/register", "/info");
  // Ensure to get initial state, and handle reconnections to controller.
  setInterval(() => {
    [...ctrls, ...auto_ctrls].forEach((ctrl) => {
      requestFeedback(`/sl/${range}/get`, "/update", {
        type: "s",
        value: ctrl,
      });
    });
  }, 2000);
};

// When the port is read, send an OSC message to, say, SuperCollider
udpPort.on("ready", function () {
  requestFeedback("/ping", "/pong");
});

const trackPads = (track) => {
  const padoffset = trackStartPad(track);
  return [0, 1, 2, 3, 4, 5, 6, 7].map((n) => n + padoffset);
};

const onUpdateTrack =
  ({ track, ctrl, value }) =>
  (state) => {
    return R.assocPath(["tracks", track, ctrl], value, state);
  };

const EV_NOTE_ON = 0x09,
  EV_NOTE_OFF = 0x08,
  EV_CC = 0x0b;

const settingcolors = [
  COLOR_BLUE,
  COLOR_LIME,
  [COLOR_WHITE, COLOR_ORANGE, COLOR_RED, COLOR_BLUE],
  COLOR_GREEN,
  COLOR_DARK_GREEN,
  COLOR_WHITE,
  COLOR_WHITE,
  COLOR_WHITE,
];

const settings = [
  "sync",
  "relative_sync",
  "quantize",
  "playback_sync",
  "mute_quantized",
];

const muteOn = [
  [1, 0, 0, 0, 1],
  [1, 1, 0, 1, 1],
  [1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
];

const soloOn = [
  [1, 0, 0, 0, 1],
  [1, 1, 0, 1, 1],
  [1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
];

const renderAllPads = () => {
  const tracks = store.getState().tracks;
  const pads = tracks.flatMap((track, i) => {
    const {
      state = 0,
      next_state,
      loop_len,
      loop_pos,
      sync,
      relative_sync,
    } = track;
    const tracknum = i;
    const gridpos = tracknum + loopoffset;
    if (gridpos < 0 || gridpos > 4) return [];
    if (state === 1 || state === 3) {
      //      console.log(`track ${i + 1} will change state: ${state} → ${next_state}`);
    }
    try {
      // No: maybe as an overlay, or partial thing, not instead of...
      // if (domute) {
      //   return trackPads(i).flatMap((pad, i) => [
      //     R.path([tracknum, i])(muteOn) ? LED_BRIGHT_100 : LED_BRIGHT_10,
      //     pad,
      //     SL_STATES[10].color,
      //   ]);
      // }
      if (set_syncs) {
        return trackPads(gridpos).flatMap((pad, i) => [
          track[settings[i]] ? LED_BRIGHT_100 : LED_BRIGHT_10,
          pad,
          settingcolors[i] instanceof Array
            ? settingcolors[i][track[settings[i]]]
            : settingcolors[i],
        ]);
      }

      const pos = 8 * (loop_pos / loop_len);
      const roundedpos = Math.floor(pos);

      return trackPads(gridpos).flatMap((pad, i) => [
        SL_STATES[state].ledmode === LED_BRIGHT_100
          ? i <= roundedpos
            ? LED_BRIGHT_100
            : LED_BRIGHT_25
          : SL_STATES[state].ledmode,
        pad,
        SL_STATES[state].color,
      ]);
    } catch (e) {
      return [];
    }
  });
  if (pads.length) output.sendMessage(pads);
};

store.subscribe(renderAllPads);

const appState = {
  tracks: [],
  glob: {},
};

const handleInfo = ({ args: [_host, _version, { value }] }) => {
  loopcount = value;
};

// Listen for incoming OSC messages.
udpPort.on("message", function (oscMsg, timeTag, info) {
  if (oscMsg.address === "/pong") {
    unregister_update();
    register_update();
    handleInfo(oscMsg);
    return;
  }
  if (oscMsg.address === "/info") {
    handleInfo(oscMsg);
    return;
  }
  if (oscMsg.address === "/update") {
    const [track, ctrl, val] = oscMsg.args.map(({ value }) => value);
    store.dispatch({ type: "track", track, ctrl, value: val });
    // if (ctrl !== "loop_pos") console.log("UPDATE");
    // if (ctrl === "loop_len") {
    //   lengths[track] = val;
    //   console.log(lengths);
    // }
    if (ctrl === "state") {
      //   handleStateMessage(track, val);
      return;
    }
    //    console.log("Remote info is: ", info);
    return;
  }
  //console.log("An OSC message just arrived!", oscMsg);
  //console.log("Remote info is: ", info);
});

// Open the socket.
udpPort.open();
