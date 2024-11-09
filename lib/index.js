import { ip } from "address";
import midi from "midi";
import osc from "osc";
import { pickPort } from "pick-port";
import mod_getopt from "posix-getopt";
import * as R from "ramda";
import { createStore } from "redux";

import {
  KnobSpeedControl,
  ButtonAutoLatch,
  cycle,
  softKeyFor,
} from "./helpers.js";
import {
  BUTTONS,
  SL_STATES,
  LED_BRIGHTS,
  LED_BRIGHT_100,
  LED_BRIGHT_90,
  LED_BRIGHT_75,
  LED_BRIGHT_65,
  LED_BRIGHT_50,
  LED_BRIGHT_25,
  LED_BRIGHT_10,
  LED_PULSING_8,
  COLOR_DARK_GREEN,
  COLOR_PINK_LIGHT,
  COLOR_PURPLE,
  COLOR_ORANGE,
  COLOR_ORANGE_LIGHT,
  COLOR_AMBER,
  COLOR_BROWNISH_RED,
  COLOR_BROWN_LIGHT,
  COLOR_GREEN,
  COLOR_RED,
  COLOR_WHITE,
  COLOR_BLUE,
  COLOR_BLUE_DARK,
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

const OSC_HOST = ip() || "0.0.0.0";
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

const pLoopoffset = ["device", "loopoffset"];
const getLoopoffset = R.pathOr(1, pLoopoffset);

let loopcount = 0;
let selecting = false;
let shifted = false;
let undoing = false;
let redoing = false;
let force_alt1 = false;
let set_syncs = false;
let dosolo = false;
let show8ths = false;
let domute = false;

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
    case "offsetUp":
      const max = 1; // ==> -1, which is all!
      return R.over(
        R.lensPath(pLoopoffset),
        (offset = 1) => Math.min(offset + 1, max),
        state
      );
    case "offsetDown":
      const min = Math.min(0, 4 - loopcount); // Leave last (fifth) row for new loops
      return R.over(
        R.lensPath(pLoopoffset),
        (offset = 1) => Math.max(offset - 1, min),
        state
      );
    case "glob":
      return R.assocPath(["glob", action.setting], action.value)(state);
    default:
      return state;
  }
}

const store = createStore(reducer);

const trackAction = (track, ctrl, value) => ({
  type: "track",
  track,
  ctrl,
  value,
});

const deviceAction = (setting, value) => ({ type: "device", setting, value });

const getDeviceSetting = (setting) => R.path(["device", setting]);

const globAction = (setting, value) => ({ type: "glob", setting, value });

const getGlob = (setting) => R.path(["glob", setting]);

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
  store.dispatch({ type: "offsetUp" });
};

const shiftDown = () => {
  store.dispatch({ type: "offsetDown" });
};

function connect(dev, name, vname) {
  // Count the available output ports.
  let count = dev.getPortCount();
  // Acquire the right port
  let port = -1;
  for (let i = 0; i < count; ++i) {
    if (dev.getPortName(i) === name) {
      port = i;
      break;
    }
  }
  // Open a virtual port in case of a disconnection, we can then
  // more easily identifythe device to reconnect.  For some reason
  // Carla does not show the connection, don't know about patchage
  // just yet - does not run on this system.
  dev.openVirtualPort("SooperLooperAkaiAPCKey25mk2Controller");
  if (port !== -1) dev.openPort(port);
}

// Set up a new output.
const output = new midi.Output();
// Set up a new input.
const input = new midi.Input();

connect(
  output,
  "APC Key 25 mk2:APC Key 25 mk2 APC Key 25 mk2 C 20:1",
  "SooperLooperAkaiAPCKey25mk2Controller"
);
connect(
  input,
  "APC Key 25 mk2:APC Key 25 mk2 APC Key 25 mk2 C 20:1",
  "SooperLooperAkaiAPCKey25mk2Controller"
);

const knobsEase = new KnobSpeedControl();
const autoLatch = new ButtonAutoLatch();

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
const onMIDIMessage = (store) => (_deltaTime, message) => {
  const { getState, dispatch } = store;
  // The message is an array of numbers corresponding to the MIDI bytes:
  //   [status, data1, data2]
  // https://www.cs.cf.ac.uk/Dave/Multimedia/node158.html has some helpful
  // information interpreting the messages.
  //  console.log(`m: ${message} d: ${deltaTime}`);
  const evtype = (message[0] >> 4) & 0x0f;
  const button = message[1];
  if (evtype === EV_NOTE_ON) console.log(performance.now(), button);
  const storeState = getState();
  const loopoffset = getLoopoffset(storeState);
  if (evtype === EV_CC) {
    const delta = knobsEase.feed(button, message[2], shifted);
    if (delta === undefined) return;
    const knobnum = message[1] - 48;
    if (showTrackVolumes(storeState)) {
      if (knobnum === 0) return;
      const level = track_levels[knobnum];
      if (!level) return;
      const loopnum = getDeviceSetting("volume-track")(getState());
      if (loopnum === -1) return;
      const currentLevel = getState().tracks[loopnum][level];
      console.log(`${level} = ${currentLevel}`);
      // console.log('not implemented on global');
      increase(delta, level, getState().tracks[loopnum], loopnum);
      return;
    }
    const loopnum = (knobnum % 4) - (loopoffset - 1);
    const funnum = Math.floor(knobnum / 4);
    const tracks = storeState.tracks;
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
    return;
  }
  if (
    (evtype === EV_NOTE_OFF || evtype === EV_NOTE_ON) &&
    button >= BUTTONS.BTN_PAD_START &&
    button <= BUTTONS.BTN_PAD_END
  ) {
    const pad = button;
    const row = padRow(pad);
    const track = row === 0 ? -1 : shiftedTrack(row, loopoffset);
    const numpad = pad % 8;
    const tracks = storeState.tracks;
    const stateTrack = R.path(["tracks", track], storeState);
    const devicemode = getDeviceMode(storeState);
    if (set_syncs) {
      if (row === 1 && numpad >= 6) {
        show8ths = evtype === EV_NOTE_ON;
        if (show8ths) {
          const setting = "eighth_per_cycle";
          let oldvalue = R.compose(R.pathOr(16, ["glob", setting]))(storeState);
          const value = numpad === 6 ? Math.max(2, oldvalue - 1) : oldvalue + 1;
          justSend("/set", { type: "s", value: setting }, { type: "f", value });
          dispatch(globAction(setting, value));
        }
        return;
      }
      // Set 8ths directly
      if (show8ths && (button < 30 || (button > 31 && button < 40))) {
        if (show8ths) {
          const setting = "eighth_per_cycle";
          const value = button + 1;
          justSend("/set", { type: "s", value: setting }, { type: "f", value });
          dispatch(globAction(setting, value));
        }
        return;
      }
    }
    if (evtype === EV_NOTE_ON) {
      if (devicemodes[devicemode] === "sessionload") {
        const uri = `${SL_SESSION_PATH}${String(button).padStart(
          2,
          "0"
        )}.slsess`;
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
        const uri = `${SL_SESSION_PATH}${String(button).padStart(
          2,
          "0"
        )}.slsess`;
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
      if (selecting) {
        if (track < loopcount) {
          dispatch(globAction("selected_loop_num", track));
          justSend(
            `/set`,
            { type: "s", value: "selected_loop_num" },
            { type: "f", value: track }
          );
        }
        return;
      }
      if (button < 32 && R.path(["device", "volume"])(storeState)) {
        let value = (numpad + 1) / 8;
        if (!stateTrack) return;
        const storedValue = stateTrack["wet"];
        if (storedValue === value) value -= 1 / 16;
        if (storedValue == 1 / 16 && numpad === 0) value = 0;
        dispatch(trackAction(track, "wet", value));
        justSend(
          `/sl/${track}/set`,
          { type: "s", value: "wet" },
          { type: "f", value }
        );
        return;
      }
      if (R.path(["device", "volume"])(storeState)) {
        const setting = "wet";
        let value = (numpad + 1) / 8;
        const storedValue = getGlob("wet")(storeState);
        if (storedValue === value) value -= 1 / 16;
        dispatch(globAction(setting, value));
        justSend(`/set`, { type: "s", value: "wet" }, { type: "f", value });
        console.log(globAction(setting, value));
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
      // if (dosolo && domute) {
      //   justSend(`/sl/${track}/hit`, { type: "s", value: "reverse" });
      //   return;
      // }
      // if (domute && set_syncs) {
      //   justSend(`/sl/${track}/hit`, { type: "s", value: "delay" });
      //   return;
      // }
      if (dosolo) {
        justSend(`/sl/${track}/hit`, { type: "s", value: "solo" });
        return;
      }
      if (domute) {
        justSend(`/sl/${track}/hit`, { type: "s", value: "mute" });
        return;
      }
      if (set_syncs) {
        if (numpad < 6) {
          const setting = settings[numpad];
          justSend(
            `/sl/${track}/set`,
            { type: "s", value: setting },
            { type: "f", value: Number(!stateTrack[setting]) }
          );
        }
        if (track === -1 && numpad === 7) {
          // NOTE: it seems just loop 1's setting is used for all
          let quant = Number(tracks[0]["quantize"]);
          if (Number.isNaN(quant)) quant = -1;
          justSend(
            `/sl/${track}/set`,
            { type: "s", value: "quantize" },
            { type: "f", value: (quant + 1) % 4 }
          );
        }
        if (track === -1 && numpad === 6) {
          // -3 = internal,  -2 = midi, -1 = jack, 0 = none, # > 0 = loop number (1 indexed)
          const setting = "sync_source";
          let oldvalue = R.compose(
            R.when(Number.isNaN, (_) => -4),
            R.pathOr(-3, ["glob", setting])
          )(storeState);
          const value = cycle(-3, loopcount, oldvalue);
          justSend(
            "/set",
            { type: "s", value: setting },
            { type: "f", value: value }
          );
          dispatch(globAction(setting, value));
        }
        return;
      }
      if (undoing && numpad <= 1) {
        justSend(`/sl/${track}/hit`, { type: "s", value: "undo_all" });
        return;
      }
      if (redoing && numpad >= 4) {
        justSend(`/sl/${track}/hit`, { type: "s", value: "redo_all" });
        return;
      }
      if (numpad === 0) {
        if (track === -1) {
          justSend(`/sl/${track}/hit`, {
            type: "s",
            value: "record_or_overdub",
          });
          return;
        }
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
        return;
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
  }

  if (evtype === EV_NOTE_ON || evtype === EV_NOTE_OFF) {
    if (button === BUTTONS.BTN_KNOB_CTRL_VOLUME) {
      dispatch(deviceAction("volume", autoLatch.feed(button, evtype)));
      dispatch(
        deviceAction(
          "pan",
          autoLatch.feed(BUTTONS.BTN_KNOB_CTRL_PAN, EV_NOTE_OFF)
        )
      );
      return;
    }
    if (button === BUTTONS.BTN_KNOB_CTRL_PAN) {
      dispatch(deviceAction("pan", autoLatch.feed(button, evtype)));
      dispatch(
        deviceAction(
          "volume",
          autoLatch.feed(BUTTONS.BTN_KNOB_CTRL_VOLUME, EV_NOTE_OFF)
        )
      );
      return;
    }
    if (evtype === EV_NOTE_ON && getDeviceSetting("volume")(storeState)) {
      if (button >= 0x52 && button <= 0x56) {
        const current = getDeviceSetting("volume-track")(storeState);
        const row = button - 0x52;
        const track = row === 0 ? -1 : shiftedTrack(row, loopoffset);
        if (track >= loopcount) return;
        if (track === current)
          dispatch(deviceAction("volume-track", undefined));
        else dispatch(deviceAction("volume-track", track));
        return;
      }
    }
    if (button === BUTTONS.BTN_SOFT_KEY_SELECT) {
      selecting = evtype === EV_NOTE_ON;
      return;
    }
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
      renderAllPads(store.getState());
      requestFeedback("/ping", "/pong");
      return;
    }
    if (button === BUTTONS.BTN_SOFT_KEY_REC_ARM) {
      set_syncs = autoLatch.feed(button, evtype);
      renderChangedPads(store.getState());
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

input.on("message", onMIDIMessage(store));

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
  console.log(performance.now(), message);
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

const track_levels = [
  "in_peak_meter",
  "rec_thresh",
  "input_gain",
  "wet",
  "dry",
  "feedback",
];

const levelcolors = [
  COLOR_RED,
  COLOR_RED,
  COLOR_LIME,
  COLOR_BLUE,
  COLOR_DARK_GREY,
  COLOR_PURPLE,
  COLOR_WHITE,
  COLOR_WHITE,
];

const ctrls = [
  "channel_count", // undocumented
  "wet",
  "dry",
  "pan_1",
  "pan_2",
  "pan_3",
  "pan_4",
  "feedback",
  "input_gain",
  "rec_thresh",
  "sync",
  "relative_sync",
  "quantize",
  "playback_sync",
  "mute_quantized",
  "overdub_quantized",
  "replace_quantized",
  "reverse",
];

const auto_ctrls = [
  "state",
  "next_state",
  "loop_pos",
  "loop_len",
  "in_peak_meter",
];

const globs = ["sync_source", "selected_loop_num", "eighth_per_cycle", "wet"];

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
  globs.forEach((ctrl) => {
    requestFeedback(`/register_update`, "/glob", {
      type: "s",
      value: ctrl,
    });
  });
  // Ensure to get initial state
  setTimeout(() => {
    [...ctrls, ...auto_ctrls].forEach((ctrl) => {
      requestFeedback(`/sl/${range}/get`, "/update", {
        type: "s",
        value: ctrl,
      });
    });
    globs.forEach((ctrl) => {
      requestFeedback(`/get`, "/glob", {
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
  COLOR_GREEN,
  COLOR_DARK_GREEN,
  COLOR_PURPLE,
  COLOR_PINK_LIGHT,
  // -3 = internal,  -2 = midi, -1 = jack, 0 = none, # > 0 = loop number (1 indexed)
  [
    COLOR_WHITE,
    COLOR_ORANGE,
    COLOR_RED,
    COLOR_DARK_GREY,
    COLOR_BLUE,
    COLOR_BLUE_DARK,
  ],
  [COLOR_WHITE, COLOR_ORANGE, COLOR_RED, COLOR_BLUE],
];

const settings = [
  "sync",
  "relative_sync",
  "playback_sync",
  "mute_quantized",
  "overdub_quantized",
  "replace_quantized",
  undefined,
  undefined, //  "quantize",
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

const padBrightnessForLevel = (num, level) => {
  const pos = num * level,
    roundedpos = Math.floor(pos),
    last = LED_BRIGHTS[Math.floor((num - 1) * (pos - roundedpos))];
  return (x) =>
    x < roundedpos ? LED_BRIGHT_100 : x === roundedpos ? last : LED_BRIGHT_10;
};

const panPads = (value) => {
  const pos = 2 * (8 - 1) * value,
    roundedpos = Math.round(pos),
    extrapad = roundedpos % 2,
    firstpad = Math.floor(roundedpos / 2);
  return R.uniq([firstpad, firstpad + extrapad]);
};

const showTrackVolumes = R.both(
  getDeviceSetting("volume"),
  R.compose(R.not, R.isNil, getDeviceSetting("volume-track"))
);

const getCellLedModeFn = R.cond([
  [
    R.path(["device", "pan"]),
    (_) => (track) => {
      if (track.channel_count === 2) {
        const padsleft = panPads(track[`pan_1`]);
        const padsright = panPads(track[`pan_2`]);
        const both = R.intersection(padsleft, padsright);
        const any = R.union(padsleft, padsright);
        return (x) =>
          both.includes(x)
            ? LED_BRIGHT_100
            : any.includes(x)
            ? LED_BRIGHT_75
            : LED_BRIGHT_25;
      }
      const pads = panPads(track[`pan_1`]);
      return (x) => (pads.includes(x) ? LED_BRIGHT_100 : LED_BRIGHT_25);
    },
  ],
  [
    showTrackVolumes,
    (state) => (track, i) => {
      return (xpad) => {
        const key = track_levels[xpad]; // in_peak_meter etc.
        const theTrack =
          state.tracks[getDeviceSetting("volume-track")(state)] || {};
        const level = theTrack[key];
        return padBrightnessForLevel(5, level)(4 - i); // LED_BRIGHT_25;
      };
    },
  ],
  [
    R.path(["device", "volume"]),
    (_) => (track) => padBrightnessForLevel(8, track["wet"]),
  ],
  [
    R.T,
    (_) => (track) => {
      let { state } = track;
      if (state === undefined) state = SL_STATE_UNKNOWN;
      const pos = 8 * (track["loop_pos"] / track["loop_len"]),
        roundedpos = Math.floor(pos),
        last = LED_BRIGHTS[Math.floor(7 * (pos - roundedpos))],
        ledmode = SL_STATES[state].ledmode;
      return (x) => {
        try {
          if (ledmode === LED_BRIGHT_100) {
            if (x <= roundedpos) return LED_BRIGHT_100;
            else return LED_BRIGHT_25;
          } else return ledmode;
        } catch (e) {
          //          console.log(track, state, x);
          return LED_BRIGHT_10;
        }
      };
    },
  ],
]);

const getCellColorFn = R.cond([
  [
    R.path(["device", "pan"]),
    (_) => (track) => {
      if (track.channel_count === 2) {
        const padsleft = panPads(track[`pan_1`]);
        const padsright = panPads(track[`pan_2`]);
        const both = R.intersection(padsleft, padsright);
        const any = R.union(padsleft, padsright);
        return (x) =>
          both.includes(x)
            ? COLOR_PURPLE
            : padsleft.includes(x)
            ? COLOR_RED
            : padsright.includes(x)
            ? COLOR_BLUE
            : SL_STATES[track.state].color;
      }
      const { state = SL_STATE_UNKNOWN } = track;
      return (x) => SL_STATES[state].color;
    },
  ],
  [
    showTrackVolumes,
    (state) => (track, i) => {
      return (xpad) => {
        // const key = track_levels[xpad]; // in_peak_meter etc.
        // const theTrack = state.tracks[getDeviceSetting("volume-track")(state)];
        // const level = theTrack[key];
        return levelcolors[xpad]; //padBrightnessForLevel(5, level)(5 - i); // LED_BRIGHT_25;
      };
    },
  ],
  [
    R.T,
    (_) =>
      ({ state = SL_STATE_UNKNOWN }) =>
      (x) =>
        SL_STATES[state].color,
  ],
]);

const createAllPads = (storeState) => {
  const devicemode = getDeviceMode(storeState);
  const loopoffset = getLoopoffset(storeState);
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
    return overlay(sessionnums, emptycells);
  }
  const tracks = R.propOr([], "tracks")(storeState);
  const toprow =
    set_syncs || showTrackVolumes(storeState)
      ? []
      : rowPads(0).flatMap((pad, i) => [
          LED_BRIGHT_90,
          pad,
          SL_STATES[trackCommands[i]].color,
        ]);

  const trackLedModeFn = getCellLedModeFn(storeState);
  const trackColorFn = getCellColorFn(storeState);

  const matrix = [0, 1, 2, 3, 4].flatMap((y) => {
    const tracknum = y - loopoffset;
    const track = tracks[tracknum] || {};
    const cellLedModeFn = trackLedModeFn(track, y);
    const cellColorFn = trackColorFn(track);
    const {
      state = SL_STATE_UNKNOWN,
      next_state,
      loop_len,
      loop_pos,
      wet,
      sync,
      relative_sync,
    } = track || {};
    //      console.log(track);
    if (!(set_syncs || showTrackVolumes(storeState)) && y === 0) {
      return toprow;
    }
    // @todo: doesnothing for the rest/
    if (set_syncs && y === 0) {
      const pads = rowPads(y).flatMap((pad, x) => [
        LED_BRIGHT_50,
        pad,
        settingcolors[x],
      ]);
      let track1 = tracks[0] || {};
      const synccolor =
        settingcolors[6][
          R.compose(
            (x) => Math.min(x, 5),
            (x) => x + 3,
            getGlob("sync_source")
          )(storeState)
        ];

      return [
        LED_BRIGHT_100,
        38,
        synccolor,
        track1["quantize"] ? LED_BRIGHT_100 : LED_BRIGHT_10,
        39,
        settingcolors[7][track1["quantize"]] || settingcolors[7][0],
        ...pads,
      ];
    }
    try {
      if (set_syncs) {
        return R.compose(
          (x) =>
            [
              LED_BRIGHT_75,
              30,
              COLOR_BROWN_LIGHT,
              LED_BRIGHT_75,
              31,
              COLOR_BROWN_LIGHT,
            ].concat(x),
          R.addIndex(R.chain)((pad, x) => [
            track[settings[x]] ? LED_BRIGHT_100 : LED_BRIGHT_10,
            pad,
            settingcolors[x] instanceof Array
              ? settingcolors[x][track[settings[x]]] || settingcolors[x][0]
              : settingcolors[x],
          ]),
          rowPads
        )(y);
      }
      return rowPads(y).flatMap((pad, x) => {
        const cell = [cellLedModeFn(x), pad, cellColorFn(x)];
        return cell;
      });
    } catch (e) {
      console.log(e);
      return [];
    }
  });
  const soft_keys = [0, 1, 2, 3, 4].flatMap((y) => {
    const tracknum = y === 0 ? -1 : y - loopoffset;
    return [
      0x90,
      0x52 + y,
      tracknum === getGlob("selected_loop_num")(storeState) ? 6 : 0,
    ];
  });
  const trackVolumeMode = showTrackVolumes(storeState);
  const vol_key = R.compose(
    R.ifElse(
      Boolean,
      (btn) => [0x90, btn, 0x02],
      (_) => []
    ),
    R.ifElse(
      showTrackVolumes,
      R.compose(
        (loop) => softKeyFor(loop, loopoffset),
        getDeviceSetting("volume-track")
      ),
      (_) => null
    )
  )(storeState);
  //  console.log(vol_key, storeState.device);
  const eighths = show8ths
    ? R.compose(
        R.chain((pad) => [LED_BRIGHT_100, pad, COLOR_BROWNISH_RED]),
        R.range(0),
        getGlob("eighth_per_cycle")
      )(storeState)
    : [];
  const pads = matrix.concat(overlay(vol_key, soft_keys));
  if (pads.length) {
    if (shifted) {
      const firstLoop = 2 - loopoffset;
      if (firstLoop > 9 && firstLoop < 100) {
        return overlay(
          makeLoopnumOverlay(Math.floor(firstLoop / 10), 2),
          makeLoopnumOverlay(firstLoop % 10, 5),
          pads
        );
      } else return overlay(makeLoopnumOverlay(firstLoop, 5), pads);
    } else {
      return overlay(eighths, pads);
    }
  }
};

let oldPads = [];

const renderChangedPads = R.compose(
  R.when(R.complement(R.isEmpty), (pads) => output.sendMessage(pads)),
  R.flatten,
  (newPads) => {
    const retval = R.difference(newPads, oldPads);
    oldPads = newPads;
    return retval;
  },
  R.splitEvery(3),
  createAllPads
);

const renderAllPads = R.compose(
  R.when(R.complement(R.isEmpty), (pads) => output.sendMessage(pads)),
  createAllPads
);

const subscribe = (store, fn) => store.subscribe(() => fn(store.getState()));

subscribe(store, renderChangedPads);

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
    if (ctrl === "in_peak_meter") {
      store.dispatch({ type: "track", track, ctrl, value: val * 2 });
    } else store.dispatch({ type: "track", track, ctrl, value: val });
    return;
  }
  if (oscMsg.address === "/glob") {
    const [_, ctrl, value] = oscMsg.args.map(({ value }) => value);
    store.dispatch(globAction(ctrl, value));
    return;
  }
});

// Open the socket.
udpPort.open();
