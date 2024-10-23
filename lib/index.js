import { ip } from "address";
import midi from "midi";
import osc from "osc";
import { pickPort } from "pick-port";
import mod_getopt from "posix-getopt";
import * as R from "ramda";
import { createStore } from "redux";

import { KnobSpeedControl } from "./helpers.js";
import {
  BUTTONS,
  SL_STATES,
  LED_BRIGHT_100,
  LED_BRIGHT_90,
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
  COLOR_DARK_GREY,
  SL_STATE_UNKNOWN,
  SL_STATE_OFF,
  SL_STATE_WAITSTART,
  SL_STATE_RECORD,
  SL_STATE_WAITSTOP,
  SL_STATE_PLAY,
  SL_STATE_OVERDUB,
  SL_STATE_MULTIPLY,
  SL_STATE_INSERT,
  SL_STATE_REPLACE,
  SL_STATE_SUBSTITUTE,
  SL_STATE_DELAY,
  SL_STATE_MUTE,
  SL_STATE_ONESHOT,
  SL_STATE_PAUSE,
  SL_STATE_OFFMUTE,
  SL_STATE_TRIGGER,
} from "./consts.js";

let OSC_SL_HOST = "127.0.0.1";
let OSC_SL_PORT = 9951;

const OSC_HOST = ip();
const OSC_PORT = await pickPort({
  type: "udp",
  ip: "0.0.0.0",
  minPort: 9000,
  maxPort: 10000,
});
const OSC_ADDRESS = `osc.udp://${OSC_HOST}:${OSC_PORT}`;

let SL_SESSION_PATH = "/zynthian/zynthian-my-data/presets/sooperlooper/";

const parser = new mod_getopt.BasicParser(
  "l:(oschost)h:(host)p:(port)P:(sessionpath)",
  process.argv
);

{
  let option;
  while ((option = parser.getopt()) !== undefined) {
    switch (option.option) {
      case "h":
        OSC_SL_HOST = option.optarg;
        break;

      case "p":
        OSC_SL_PORT = option.optarg;
        break;

      case "P":
        SL_SESSION_PATH = option.optarg;
        break;

      default:
        break;
    }
  }
}

function reducer(state = { tracks: [] }, action) {
  switch (action.type) {
    case "track":
      return onUpdateTrack(action)(state);
    case "empty-track":
      return R.assocPath(["tracks", action.value], {})(state);
    case "device":
      return R.assocPath(
        ["device", action.setting].flat(),
        action.value
      )(state);
    case "glob":
      return R.assoc(["glob", action.setting], action.value)(state);
    default:
      return state;
  }
}

const store = createStore(reducer);

const deviceAction = (setting, value) => ({ type: "device", setting, value });

let loopcount = 0;

let shifted = false;
let undoing = false;
let redoing = false;
let force_alt1 = false;
let set_syncs = false;
let dosolo = false;
let domute = false;
let loopoffset = 1;

const devicemodes = ["loops", "sessionsave", "sessionload"];

const getDeviceMode = R.pathOr(0, ["device", "mode"]);

const getSessions = () => {
  const body = {
    address: "/sessions",
    args: [
      { type: "s", value: OSC_HOST },
      { type: "i", value: OSC_PORT },
      { type: "s", value: "/sessions" },
    ],
  };
  udpPort.send(body, OSC_SL_HOST, 1234);
};
const cycleDeviceMode = (store) => {
  const state = store.getState();
  let devicemode = getDeviceMode(state);
  devicemode = (devicemode + 1) % devicemodes.length;
  if (devicemode > 0) getSessions();
  store.dispatch(deviceAction("mode", devicemode));
};

const range = (start = 0) => `[${start}-${loopcount - 1}]`;

const rowStartPad = (y) => (4 - y) * 8;
const padRow = (pad) => [4, 3, 2, 1, 0].indexOf(Math.floor(pad / 8));
const shiftedTrack = (track, offset) => track - offset;

const shiftUp = () => {
  const max = 1; // ==> -1, which is all!
  loopoffset = Math.min(loopoffset + 1, max);
  renderAllPads();
};

const shiftDown = () => {
  const min = Math.min(0, 4 - loopcount); // Leave last (fifth) row for new loops
  loopoffset = Math.max(loopoffset - 1, min);
  renderAllPads();
};

// Set up a new output.
const output = new midi.Output();

// Open the first available output port.
output.openPort(0);

// Set up a new input.
const input = new midi.Input();

input.openVirtualPort("SooperLooperAkai");
// Count the available input ports.

const knobsEase = new KnobSpeedControl();

const increase = (delta, ctrl, track, loopnum) => {
  const curval = track[ctrl];
  if (curval === undefined) return;
  justSend(
    `/sl/${loopnum}/set`,
    { type: "s", value: ctrl },
    { type: "f", value: Math.max(0, Math.min(1, curval + delta * 0.1)) }
  );
};

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

  if (evtype === EV_CC) {
    const delta = knobsEase.feed(button, message[2], shifted);
    if (delta === undefined) return;
    const knobnum = message[1] - 48;
    const loopnum = (knobnum % 4) - (loopoffset - 1);
    const funnum = Math.floor(knobnum / 4);
    console.log("CC!", { loopnum, funnum, knobnum, delta });
    const tracks = store.getState().tracks;
    const track = tracks[loopnum];
    if (!track) return;
    const funs = ["wet", "pan"];
    const fun = funs[funnum];
    if (fun === "pan") {
      const channel_count = track["channel_count"];
      for (let c = 1; c <= channel_count; c++) {
        const ctrl = `pan_${c}`;
        if (shifted) {
          if (c === 2 && channel_count === 2)
            increase(-delta, ctrl, track, loopnum);
          else increase(delta, ctrl, track, loopnum);
        } else {
          if (channel_count === 2) {
            if (c === 1) {
              if (delta < 0 || track["pan_2"] >= 0.5) {
                increase(delta, ctrl, track, loopnum);
              }
            }
            if (c === 2) {
              if (delta > 0 || track["pan_1"] <= 0.5) {
                increase(delta, ctrl, track, loopnum);
              }
            }
          } else increase(delta, ctrl, track, loopnum);
        }
      }
    } else {
      increase(delta, fun, track, loopnum);
    }
    console.log(track);
    console.log(loopnum - (loopoffset - 1));
    return;
  }
  // console.log(button, BUTTONS.BTN_PAD_START);
  if (
    evtype === EV_NOTE_ON &&
    button >= BUTTONS.BTN_PAD_START &&
    button <= BUTTONS.BTN_PAD_END
  ) {
    const pad = button;
    const row = padRow(pad);
    const track = row === 0 ? -1 : shiftedTrack(row, loopoffset);
    const numpad = pad % 8;
    const stateTrack = R.path(["tracks", track], store.getState());
    const devicemode = getDeviceMode(store.getState());
    if (devicemodes[devicemode] === "sessionload") {
      const uri = `${SL_SESSION_PATH}${String(button).padStart(2, "0")}.slsess`;
      justSend(
        `/load_session`,
        { type: "s", value: uri },
        {
          type: "s",
          value: OSC_ADDRESS,
        },

        { type: "s", value: "/error" }
      );
      setTimeout(() => requestFeedback("/ping", "/pong"), 1000);
    }
    if (devicemodes[devicemode] === "sessionsave") {
      const uri = `${SL_SESSION_PATH}${String(button).padStart(2, "0")}.slsess`;
      justSend(
        `/save_session`,
        { type: "s", value: uri },
        {
          type: "s",
          value: OSC_ADDRESS,
        },

        { type: "s", value: "/error" },
        { type: "i", value: 1 }
      );
        setTimeout(getSessions, 1000);
      return;
    }
    if (track >= loopcount && numpad < 4) {
      justSend(
        `/loop_add`,
        { type: "i", value: (numpad + 1) % 4 }, // mono - 4 channels, repeating
        { type: "f", value: 40 }
      );
      return;
    }
    if (track >= loopcount && numpad > 3) {
      console.log("deleting");
      justSend(
        `/loop_del`,
        { type: "i", value: -1 } // Last loop -- the only supported one
      );
      return;
    }

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
        R.propOr(SL_STATE_UNKNOWN, "state", stateTrack) < SL_STATE_RECORD || // Off or undefined
        (!force_alt1 && R.prop("state", stateTrack) === SL_STATE_RECORD) || // Recording sans force => play
        (force_alt1 && R.prop("state", stateTrack) !== SL_STATE_RECORD) // Not recording, having data, but forced
      ) {
        justSend(`/sl/${track}/hit`, { type: "s", value: "record" });
      } else {
        justSend(`/sl/${track}/hit`, { type: "s", value: "overdub" });
      }
    }
    if (numpad === 1) {
      if (undoing)
        justSend(`/sl/${track}/hit`, { type: "s", value: "undo_all" });
      else justSend(`/sl/${track}/hit`, { type: "s", value: "multiply" });
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
      if (redoing)
        justSend(`/sl/${track}/hit`, { type: "s", value: "redo_all" });
      else justSend(`/sl/${track}/hit`, { type: "s", value: "substitute" });
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
      }
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
    if (button === BUTTONS.BTN_STOP_ALL_CLIPS) {
      requestFeedback("/ping", "/pong");
      return;
    }
    if (button === BUTTONS.BTN_SOFT_KEY_REC_ARM) {
      set_syncs = evtype === EV_NOTE_ON;
      renderAllPads();
      return;
    }
    if (button === BUTTONS.BTN_KNOB_CTRL_DEVICE) {
      if (evtype === EV_NOTE_ON) {
        cycleDeviceMode(store);
      }
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

const udpPort = new osc.UDPPort({
  localAddress: OSC_HOST,
  localPort: OSC_PORT,
  metadata: true,
});

// When the port is read, send an OSC message to, say, SuperCollider
udpPort.on("ready", function () {
  console.log(`Listening on ${OSC_ADDRESS}`);
  requestFeedback("/ping", "/pong");
});


const justSend = (address, ...args) => {
  const message = {
    address,
    args: [...args],
  };
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
  udpPort.send(message, OSC_SL_HOST, OSC_SL_PORT);
};

const ctrls = [
  "channel_count", // undocumented
  "wet",
  "pan_1",
  "pan_2",
  "pan_3",
  "pan_4",
  "feedback",
  "input_gain",
  "sync",
  "relative_sync",
  "quantize",
  "playback_sync",
  "mute_quantized",
];

const auto_ctrls = ["state", "next_state", "loop_pos", "loop_len"];

const unregister_update = (range) => {
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

const register_update = (range) => {
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
  // Ensure to get initial state
  setTimeout(() => {
    [...ctrls, ...auto_ctrls].forEach((ctrl) => {
      requestFeedback(`/sl/${range}/get`, "/update", {
        type: "s",
        value: ctrl,
      });
    });
  }, 2000);
};

const rowPads = (track) => {
  const padoffset = rowStartPad(track);
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

const trackCommands = [2, 6, 7, 8, 13, 12, 30, 14];

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

const overlay = R.compose(
  R.flatten,
  R.sortBy(R.nth(1)),
  R.uniqBy(R.nth(1)),
  R.apply(R.concat),
  R.map(R.splitEvery(3)),
  (...arrays) => arrays
);

const chars = {
  1: ["_._", ".._", "_._", "_._", "..."],
  2: ["_._", "._.", "__.", "_._", "..."],
  3: ["...", "__.", "_._", "__.", ".._"],
  4: [".__", "._.", "...", "__.", "__."],
  5: ["...", ".__", "...", "__.", "..."],
  6: ["_._", ".__", "...", "._.", "..."],
  7: ["...", "__.", "_._", "_._", ".__"],
  8: ["...", "._.", "...", "._.", "..."],
  9: ["_._", "._.", "...", "__.", "..."],
  0: ["_._", "._.", "._.", "._.", "_._"],
};

const matrixPadLedmode = { ".": LED_BRIGHT_100, _: LED_BRIGHT_10 };
const matrixPadColor = { ".": COLOR_WHITE, _: COLOR_DARK_GREY };

const makeLoopnumOverlay = (char, col = 0) => {
  const spec = chars[char];
  if (!spec) return [];
  return spec.flatMap((charSpec, rownum) => {
    const startPad = rowStartPad(rownum) + col;
    return charSpec.split("").reduce((acc, boolish, i) => {
      const pad = startPad + i;
      return [...acc, matrixPadLedmode[boolish], pad, matrixPadColor[boolish]];
    }, []);
  });
};

const renderAllPads = (storeState) => {
  const devicemode = getDeviceMode(storeState);
  if (devicemode > 0) {
    const color =
      devicemodes[devicemode] === "sessionload"
        ? COLOR_DARK_GREEN
        : COLOR_ORANGE;
    const sessionnums = R.compose(
      R.chain((x) => [LED_BRIGHT_100, parseInt(x), color]),
      R.pathOr([], ["device", "sessions"])
    )(storeState);
    const emptycells = R.chain(
      R.compose(
        R.chain((pad, x) => [LED_BRIGHT_25, pad, color]),
        rowPads
      )
    )([0, 1, 2, 3, 4]);
    output.sendMessage(overlay(sessionnums, emptycells));
    return;
  }
  const tracks = R.propOr([], 'tracks')(storeState);
  const toprow = set_syncs
    ? []
    : rowPads(0).flatMap((pad, i) => [
        LED_BRIGHT_90,
        pad,
        SL_STATES[trackCommands[i]].color,
      ]);

  const pads = [0, 1, 2, 3, 4].flatMap((y) => {
    //    const tracknum = i - 1;
    const tracknum = y - loopoffset;
    const track = tracks[tracknum] || {};
    const {
      state = SL_STATE_UNKNOWN,
      next_state,
      loop_len,
      loop_pos,
      sync,
      relative_sync,
    } = track || {};
    if (!set_syncs && y === 0) {
      return toprow;
    }
    try {
      // No: maybe as an overlay, or partial thing, not instead of...
      // if (domute) {
      //   return rowPads(i).flatMap((pad, i) => [
      //     R.path([tracknum, i])(muteOn) ? LED_BRIGHT_100 : LED_BRIGHT_10,
      //     pad,
      //     SL_STATES[10].color,
      //   ]);
      // }
      if (set_syncs) {
        return rowPads(y).flatMap((pad, x) => [
          track[settings[x]] ? LED_BRIGHT_100 : LED_BRIGHT_10,
          pad,
          settingcolors[x] instanceof Array
            ? settingcolors[x][track[settings[x]]] || settingcolors[x][0]
            : settingcolors[x],
        ]);
      }

      const pos = 8 * (loop_pos / loop_len);
      const roundedpos = Math.floor(pos);

      return rowPads(y).flatMap((pad, x) => {
        const cell = [
          SL_STATES[state].ledmode === LED_BRIGHT_100
            ? x <= roundedpos
              ? LED_BRIGHT_100
              : LED_BRIGHT_25
            : SL_STATES[state].ledmode,
          pad,
          SL_STATES[state].color,
        ];
        if (tracknum % 3 === 0 && tracknum !== 0) {
          if (x === 7) return [LED_BRIGHT_100, pad, COLOR_ORANGE];
        }
        if (y === 4) {
        }
        return cell;
      });
    } catch (e) {
      console.log(e);
      return [];
    }
  });
  if (pads.length) {
    if (shifted) {
      const firstLoop = 2 - loopoffset;
      if (firstLoop > 9 && firstLoop < 100) {
        output.sendMessage(
          overlay(
            makeLoopnumOverlay(Math.floor(firstLoop / 10), 2),
            makeLoopnumOverlay(firstLoop % 10, 5),
            pads
          )
        );
      } else
        output.sendMessage(overlay(makeLoopnumOverlay(firstLoop, 5), pads));
    } else {
      output.sendMessage(pads);
    }
  }
};

const subscribe = (store, fn) => store.subscribe(() => fn(store.getState()));

subscribe(store, renderAllPads);

const handleInfo = ({ args: [_host, _version, { value }] }) => {
  loopcount = value;
};

// Listen for incoming OSC messages.
udpPort.on("message", function (oscMsg, timeTag, info) {
  if (oscMsg.address === "/error") {
    console.log(oscMsg);
    return;
  }
  if (oscMsg.address === "/pong") {
    console.log(oscMsg);
    requestFeedback("/register", "/info");
    handleInfo(oscMsg);
    register_update(range());
    return;
  }
  if (oscMsg.address === "/sessions") {
    store.dispatch(
      deviceAction(
        "sessions",
        oscMsg.args.map(({ value }) => value)
      )
    );
  }
  if (oscMsg.address === "/info") {
    let previousCount = loopcount;
    handleInfo(oscMsg);
    if (loopcount > previousCount) {
      register_update(`[${R.range(previousCount, loopcount)}]`);
      R.range(previousCount, loopcount).forEach((c) => {
        register_update(c);
        justSend(
          `/sl/${c}/set`,
          { type: "s", value: "sync" },
          { type: "f", value: 1 }
        );
      });
    }
    if (loopcount < previousCount) {
      R.range(loopcount, previousCount).forEach((c) =>
        store.dispatch({ type: "empty-track", value: c })
      );
    }
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
