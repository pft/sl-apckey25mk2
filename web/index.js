WebMidi.enable()
  .then(onEnabled)
  .catch((err) => alert(err));

function onEnabled() {
  const output = WebMidi.getOutputByName(
    "SooperLooperAkaiAPCKey25mk2Controller"
  );
  const grid = document.getElementById("grid");
  setDescriptions(grid, "loop");
  document.addEventListener("mousedown", ({ target }) => {
    if (target.matches("[data-note]")) {
      output.channels[1].playNote(Number(target.dataset["note"]));
    }
  });
  document.addEventListener("mouseup", ({ target }) => {
    if (target.matches("[data-note]")) {
      output.channels[1].stopNote(Number(target.dataset["note"]));
    }
  });
  document.addEventListener("change", ({ target }) => {
    const grid = document.getElementById("grid");
    if (target.matches('select[name="mode"]')) {
      grid.dataset["mode"] = target.value;
      setDescriptions(grid, target.value);
    }
  });
  const state = {};
  const range = (from, to) => {
    let arr = [];
    for (let i = 0, val = from; val < to; val++, i++) {
      arr[i] = val;
    }
    return arr;
  };
  const mySynth = WebMidi.getInputByName(
    "SooperLooperAkaiAPCKey25mk2Controller"
  );

  let i = 0;
  mySynth.addListener("noteon", (e) => {
    const data = e.rawData;
    const [ev, note, value] = e.rawData;
    state[note] = e.rawData;
    const pad = document.querySelector(`*[data-note="${note}"]`);
    if (pad === null) {
      console.warn("no pad for ${note.toString(16)}");
    }
    if (note < 40) {
      pad.dataset["color"] = value;
      pad.dataset["ledmode"] = `0x${ev.toString(16)}`;
    } else if (ev === 0x90) {
      pad.dataset["ledmode"] = value === 2 ? "blink" : "continuous";
    } else {
      delete pad.dataset.ledmode;
    }
    // renderPads(state);
    // document.getElementById('log').innerHTML = `${e.note.name} ${e.channel} ${JSON.stringify(e.data)}`;
  });
  mySynth.addListener("noteoff", (e) => {
    const data = e.rawData;
    const [ev, note, value] = e.rawData;
    state[note] = e.rawData;
    const pad = document.querySelector(`*[data-note="${note}"]`);
    if (pad === null) {
      console.warn("no pad for ${note.toString(16)}");
    }
    if (note < 40) {
      // pad.dataset["color"] = value;
      // pad.dataset["ledmode"] = `0x${ev.toString(16)}`;
    } else {
      delete pad.dataset.ledmode;
    }
    // renderPads(state);
    // document.getElementById('log').innerHTML = `${e.note.name} ${e.channel} ${JSON.stringify(e.data)}`;
  });
}
const descriptions = {
  loop: [
    `[Rec/Overdub]`,
    `[Multiply]`,
    `[Insert]`,
    `[Replace]`,
    `[Substitute]`,
    `[Oneshot]`,
    `[Trigger]`,
    `[Pause]`,
  ],
  "levels-2": [
    "Peak meter",
    "Record Threshold",
    "Input Gain",
    "Wet",
    "Dry",
    "Feedback",
  ],
  sync: [
    "Sync",
    "Relative sync",
    "Playback sync",
    "Mute quantized",
    "Overdub quantized",
    "Replace quantized"
  ],
};

const setDescriptions = (grid, mode) => {
  grid.querySelectorAll(".coldesig").forEach((des, x) => {
    des.innerText = (descriptions[mode] || [])[x] || ""; //console.log(des, x);
  });
};
