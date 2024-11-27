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

Mute + the top row should toggles muteness of all loops. Maybe we should just mute them instead.

Clip stop, Rec Arm, and Select are still free.

### Track buttons

`[Shift + ▲]` and `[Shift + ▼]`:

Shift plus the Up or Down key shifts the loops, as long as there are
some. During Shift press, you'll see a number indicating the top loop.

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

## Levels mode 2: 6 levels for selected loop

Invoke by pressing `[Volume]` button twice. The `[Volume]` button will pulsate red.

Peak meter (red) - Record Threshold (red) - Input Gain (lime) - Wet (blue - think water) - Dry (dark grey) - Feedback (purple)

You can use the pads, and knobs 2-6 will control the levels of each column.

## Pan mode

@todo

## Sync/Quantize mode

@todo
