import osc from "osc";
import midi from "midi";

const trackStartPad = (track) => (4 - track) * 8;
const padTrack = (pad) => [4, 3, 2, 1, 0].indexOf(Math.floor(pad / 8));

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
input.on("message", (deltaTime, message) => {
  // The message is an array of numbers corresponding to the MIDI bytes:
  //   [status, data1, data2]
  // https://www.cs.cf.ac.uk/Dave/Multimedia/node158.html has some helpful
  // information interpreting the messages.
  //  console.log(`m: ${message} d: ${deltaTime}`);

  // Send a MIDI message.
  if (message[2]) {
    const pad = message[1];
    const track = padTrack(pad);
    console.log("track", track, pad);
    if (pad % 8 === 0) {
      justSend(`/sl/${track}/hit`, { type: "s", value: "record" });
    }
    if (pad % 8 === 1) {
      justSend(`/sl/${track}/hit`, { type: "s", value: "overdub" });
    }
    //  output.sendMessage([0x97, message[1], 20]);
  }
});
// Open the first available input port.
input.openPort(1);

// Sysex, timing, and active sensing messages are ignored
// by default. To enable these message types, pass false for
// the appropriate type in the function below.
// Order: (Sysex, Timing, Active Sensing)
// For example if you want to receive only MIDI Clock beats
// you should use
// input.ignoreTypes(true, false, true)
input.ignoreTypes(false, false, false);

// ... receive MIDI messages ...

// Close the port when done.
// setTimeout(function () {
//   input.closePort();
// }, 100000);

// setTimeout(() => {
//   output.sendMessage([0x96, 0, 40]);
// }, 5000);

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
  console.log(message);
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
  console.log(message);
  udpPort.send(message, "127.0.0.1", OSC_SL_PORT);
};

const ctrls = ["feedback", "input_gain", "loop_len"];
const auto_ctrls = ["state", "loop_pos"];
const lengths = [];
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

const handleStateMessage = (track, val) => {
  console.log(track, val);
  const padoffset = trackStartPad(track);
  if (val === 0) {
    console.log("OFF");
    // Off
    output.sendMessage(
      trackPads(track)
        .map((pad) => [0x90, pad, 52])
        .flat()
    );
  }
  if (val === 2) {
    console.log("REC");
    // Record
    //    output.sendMessage([0x98, padoffset, 0x05, 0x96, padoffset + 1, 0x05]);
    output.sendMessage(
      trackPads(track)
        .map((pad) => [0x9a, pad, 0x05])
        .flat()
    );
  }
  if (val === 4) {
    console.log("PLAY");
    // Play
    output.sendMessage(
      trackPads(track)
        .map((pad) => [0x96, pad, 0x15])
        .flat()
    );
    //    output.sendMessage([0x96, padoffset, 0x15]);
  }
  if (val === 5) {
    console.log("OVERDUB");
    // Overdub
    output.sendMessage(
      trackPads(track)
        .map((pad) => [0x9f, pad, 53])
        .flat()
    );
  }
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
    if (ctrl !== "loop_pos") console.log("UPDATE");
    if (ctrl === "loop_len") {
      lengths[track] = val;
      console.log(lengths);
    }
    if (ctrl === "state") {
      handleStateMessage(track, val);
      return;
    }
    //    console.log("Remote info is: ", info);
    return;
  }
  console.log("An OSC message just arrived!", oscMsg);
  console.log("Remote info is: ", info);
});

// Open the socket.
udpPort.open();
