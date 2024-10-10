import osc from "osc";
import midi from "midi";
import { createStore } from "redux";
import { BUTTONS, SL_STATES } from "./consts.js";
import * as R from "ramda";

const trackStartPad = (track) => (4 - track) * 8;
const padTrack = (pad) => [4, 3, 2, 1, 0].indexOf(Math.floor(pad / 8));
function reducer(state = { tracks: [] }, action) {
  switch (action.type) {
    case "track":
      return onUpdateTrack(action)(state);
    default:
      return state;
  }
}

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

let shifted = false;
let undoing = false;
let redoing = false;
let force_alt1 = false;
let dosolo = false;
let domute = false;

// Configure a callback.
input.on("message", (deltaTime, message) => {
  // The message is an array of numbers corresponding to the MIDI bytes:
  //   [status, data1, data2]
  // https://www.cs.cf.ac.uk/Dave/Multimedia/node158.html has some helpful
  // information interpreting the messages.
  //  console.log(`m: ${message} d: ${deltaTime}`);
  const evtype = (message[0] >> 4) & 0x0f;
  const button = message[1];

  if (evtype === EV_NOTE_ON) {
    console.log("Note on!", button);
  }

  if (evtype === EV_NOTE_OFF) {
    console.log("Note off!");
  }

  if (evtype === EV_CC) {
    console.log("CC!");
  }
  console.log(button, BUTTONS.BTN_PAD_START);
  if (
    evtype === EV_NOTE_ON &&
    button >= BUTTONS.BTN_PAD_START &&
    button <= BUTTONS.BTN_PAD_END
  ) {
    console.log("Hit a Pad");
    const pad = button;
    const track = padTrack(pad);
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
    if (button === BUTTONS.BTN_TRACK_1) {
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
  }
});
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

const OSC_SL_PORT = 9951;

var udpPort = new osc.UDPPort({
  localAddress: "127.0.0.1",
  localPort: OSC_SL_PORT + 1,
  metadata: true,
});

const justSend = (address, ...args) => {
  const message = {
    address,
    args: [...args],
  };
  //console.log(message);
  udpPort.send(message, "127.0.0.1", OSC_SL_PORT);
};

const requestFeedback = (address, path, ...args) => {
  const message = {
    address,
    args: [
      ...args,
      {
        type: "s",
        value: "osc.udp://127.0.0.1:9952",
      },
      {
        type: "s",
        value: path,
      },
    ],
  };
  //console.log(message);
  udpPort.send(message, "127.0.0.1", OSC_SL_PORT);
};

const ctrls = ["feedback", "input_gain", "loop_len"];
const auto_ctrls = ["state", "next_state", "loop_pos"];

const unregister_update = () => {
  ctrls.forEach((ctrl) => {
    requestFeedback("/sl/[0-4]/unregister_update", "/update", {
      type: "s",
      value: ctrl,
    });
  });
  auto_ctrls.forEach((ctrl) => {
    requestFeedback("/sl/[0-4]/unregister_auto_update", "/update", {
      type: "s",
      value: ctrl,
    });
  });
};

const register_update = () => {
  ctrls.forEach((ctrl) => {
    requestFeedback("/sl/[0-4]/register_update", "/update", {
      type: "s",
      value: ctrl,
    });
  });
  auto_ctrls.forEach((ctrl) => {
    requestFeedback(
      "/sl/[0-4]/register_auto_update",
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
  // Ensure to get initial state, and handle reconnections to controller.
  setInterval(() => {
    [...ctrls, ...auto_ctrls].forEach((ctrl) => {
      requestFeedback("/sl/[0-4]/get", "/update", {
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

const renderAllPads = () => {
  const tracks = store.getState().tracks;
  const pads = tracks.flatMap(({ state = 0, next_state }, i) => {
    if (state === 1 || state === 3) {
      console.log(`track ${i + 1}: ${state} → ${next_state}`);
    }
    try {
      return trackPads(i).flatMap((pad) => [
        SL_STATES[state].ledmode,
        pad,
        SL_STATES[state].color,
      ]);
    } catch (e) {
      console.log("state undefined?", state);
      throw e;
    }
  });
  output.sendMessage(pads);
};
store.subscribe(renderAllPads);

const appState = {
  tracks: [],
  glob: {},
};

// Listen for incoming OSC messages.
udpPort.on("message", function (oscMsg, timeTag, info) {
  if (oscMsg.address === "/pong") {
    unregister_update();
    register_update();
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
