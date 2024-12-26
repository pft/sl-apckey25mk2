# Installation

```
npm i
```

For session saving and loading, run:

```
python lib/sessions.py <sessiondir>
```

# Usage

There are three main Device Modes. The `Device` button cycles between them:

1. Looper mode
2. Session save mode
3. Session/loop(@todo) load mode

Then there are two Levels modes, one Pan mode, one Sync/Quantize mode.

## Device mode 1: Looper mode

This is the basic, default, mode we start with.

![image](https://github.com/user-attachments/assets/e6572158-7ece-4728-b876-0dd534a4c04b)

The 8×5 grid of RGB Leds control looping commands and reflect the current state of a loop.

The first row shows the commands for all the tracks.

The commands are:

`[Rec/Overdub (red)]` `[Multiply (amber)]` `[Insert (warm pink)]` `[Replace (pink light]` `[Substitute (pink)]` `[Oneshot (light green)]` `[Trigger (green)]` `[Pause (lime)]`.

Rec will change to overdub on non-empty loops.

The following four rows initially show the first four loops.

Their pads do the same as the all-loop pads in the same position.

For the Rec/Overdub button, holding the Up button while pressing
Rec/Overdub will reverse the action. I.e. force record when overdub
would be the normal action. Or go straight into overdub from
recording. The Rec/Overdub button in the 'All row' **always** invokes
record_or_overdub, i.e. do the safe thing.

When a pad's function is active, the entire row will have that color.

The brightness of a loop row indicates the playing position in the the loop.

When a loop is pulsating, it is waiting, e.g. to record.

### Soft keys

Solo + any loop pad (toggle-)soloes that loop.

Mute + any loop pad toggles whether that loop is muted.

Mute + the top row toggles muteness of all loops.

Stop all clips mutes all clips.

Shift+Stop all clips unmutes all clips.

Clip stop, Rec Arm, and Select are still free.

### Track buttons

`[Shift + ▲]` and `[Shift + ▼]`:

Shift plus the Up or Down key shifts the loops, as long as there are
some. During Shift press, you'll see a number indicating the top loop.

![shifting the loops](https://github.com/user-attachments/assets/19b98756-5793-4c90-854d-6602b370aa8b)

`[Shift + <a row's soft key>]`: 

Sets the selected loop in SooperLooper. The selected loop is what is used in Level mode 2, and also often a target of other controllers (such as a single pedal).

The softkey of the selected loop will be lit green. When the mode is active targeting the selected loop, such as Levels Mode 2, the softkey will pulsate in green.

`[◀]` and `[▶]`:

The left and right arrows + a pad in the same column perform Undo and Redo on a loop.

Pressing the left arrow + a pad in a column to the left of its column performs Undo All.

Pressing the right arrow + a pad in a column to the right of its column performs Redo All.

`[Volume]`:

Cycles through the two Levels modes.

`[Pan]`:

Opens the Pan mode

`[Send]`:

Opens the Sync/Quantize mode.

`[Device]`:

Cycles through the three Device Modes.

### Knobs

The (top) Knobs 1-4 control the wet signal (volume level) for the 4 displayed loops.

The (bottom) Knobs 5-8 control the pan of the 4 displayed loops.

## Device mode 2: Session save mode

Pressing a pad saves the current session to one of the 40 locations.

Invoke by pressing `[Device]` button once. The `[Device]` button will light up red.

The session path is `"/zynthian/zynthian-my-data/presets/sooperlooper/"` by default. Change it on start-up with the `-P` parameter.

Run `python lib/sessions.py <sessiondir>` to get feedback on which pads have storage.

## Device mode 3: Session load mode

Pressing a pad loads a session stored under that pad.

Invoke by pressing `[Device]` twice. The `[Device]` button will light pulsate red.

## Levels mode 1: volume (wet) levels for all displayed loops

Invoke by pressing `[Volume]` button once. The `[Volume]` button will light up red.

You can use the pads to adjust volume levels.

![image](https://github.com/user-attachments/assets/0a1ee7b7-b953-4ce3-9d74-3f765bf6a5f6)

## Levels mode 2: 6 levels for selected loop

Invoke by pressing `[Volume]` button twice. Both the `[Volume]` button and the softkey next to the selected loop will pulsate red.

Peak meter (red) - Record Threshold (red) - Input Gain (lime) - Wet (blue - think water) - Dry (dark grey) - Feedback (purple)

You can use the pads, and knobs 2-6 will control the levels of each column.

![apc-levels](https://github.com/user-attachments/assets/23fea30b-70d8-4055-8505-2d6b960cbaa3)

## Pan mode

Invoke by pressing `[Pan]` button once. The `[Pan]` button will light up red.

The pan settings for each displayed loop is shown. Stereo loops show the left channel as red, the right one as blue.

Mono loops show the setting simply in a brighter color of the current state.

Panning cannot (yet) be edited via buttons, use the Knobs for that.

![image](https://github.com/user-attachments/assets/d8f34e60-0202-4365-8116-5fd24e138542)

## Sync/Quantize mode

![image](https://github.com/user-attachments/assets/54a12d32-2283-4331-a9b1-1317e7498563)


@todo
