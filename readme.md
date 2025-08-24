# Installation

```
npm i
```

For session saving and loading, run:

```
python lib/sessions.py <sessiondir>
```

# Usage

The device starts in the Looper Mode.

Besides that, there are two Levels modes, one Pan mode, one Sync/Quantize mode, and two Session modes

The present mode is indicated by the four buttons Volume, Pan, Send and Device.

`[Volume]`:

Cycles through the two Levels modes.

`[Pan]`:

Opens the Pan mode

`[Send]`:

Opens the Sync/Quantize mode.

`[Device]`:

Cycles through the two Session Modes.

## Looper mode

This is the basic, default, mode we start with. If this mode is one, none of the fout indicators is lit.

![image](https://github.com/user-attachments/assets/e6572158-7ece-4728-b876-0dd534a4c04b)

The 8×5 grid of RGB Leds control looping commands and reflect the current state of a loop.

Adding a loop: press the leftmost pad on an empty loop row to add a
mono loop, press the second pad to add a stereo loop. 3rd for three
channels, 4th for four.

Remove the last loop by pressing any of pad 5-8 on an empty loop.

The first row shows the column commands for all the tracks.

The commands are:

`[Rec/Overdub (red)]` `[Multiply (amber)]` `[Insert (warm pink)]` `[Replace (pink light]` `[Substitute (pink)]` `[Oneshot (light green)]` `[Trigger (green)]` `[Pause (lime)]`.

Record will change to overdub on non-empty loops.

The following four rows initially show the first four loops.

Their pads do the same as the all-loop pads in the same position.

For the Rec/Overdub pad, holding the Up (▲) pad while pressing a
Rec/Overdub pad will reverse the action. This means it forcing record
when overdub would be the normal action. You can also use this to go
straight into overdub from recording. The Rec/Overdub button in the 
'All row' **always** invokes native record\_or\_overdub.

On the Zynthian driver, pressing one of these pads and holding it for
more than 1 second will make that pad function as a momentary
toggle. @todo: implement this here too.

When a pad's function is active, the entire row will have that
color. Overdub being purple.

The brightness of a loop row indicates the playing position in the loop.

When a loop is blinking quickly, it is waiting, e.g. to record.

### Groups (Zynthian only)

The first 5 'global' pads contain five groups. You can use them for
grouping loops used for chorus/verse/bridge etc.

If loops are assigned to a group pad pressing that group pad will
unmute its loops and mute all other loops.

### Soft keys

Solo + any loop pad (toggle-)soloes that loop.

Mute + any loop pad toggles whether that loop is muted.

Mute + the top row **toggles** muteness of all loops.

Stop all clips mutes all clips.

Shift+Stop all clips unmutes all clips.

Clip stop and Rec Arm are still free.

(Zynthian only:) Select toggles the group assign mode. When this is active,
press one of the five group pads and select which loops it
contains. NOTE: groups are not saved, nor restored, with sessions or
in a snapshot. They are ephemeral and act globally.

### Track buttons

`[Shift + ▲]` and `[Shift + ▼]`:

Shift plus the Up or Down key shifts the loops in view, as long as there are
some. During Shift press, you'll see a number indicating the top loop.

![shifting the loops](https://github.com/user-attachments/assets/19b98756-5793-4c90-854d-6602b370aa8b)

`[Shift + <a row's soft key>]`:

Sets the selected loop in SooperLooper. The selected loop is what is used in Level mode 2, and also often a target of other controllers (such as a single pedal).

The softkey of the selected loop will be lit green. When the mode is active targeting the selected loop, such as Levels Mode 2, the softkey will pulsate in green.

`[◀]` and `[▶]`:

The left and right arrows + a pad in the same column perform Undo and Redo on a loop.

Pressing the left arrow + a pad in a column to the left of its column performs Undo All on a loop.

Pressing the right arrow + a pad in a column to the right of its column performs Redo All on a loop.

I found this to be quite intuitive: undo/redo to the extreme.

`[◀]` plus the 'global record' on the top left this way acts as a nice shortcut to clear all loops.

#### ALT mode (Zynthian only)

Pressing the first track button momentarily enters alt mode (not to be confused with Zynthian v5 mode). 

While in alt mode, the third button in a loop functions as Reverse.

And the fourth button in a loop functions as the Delay Trigger. This
is a very confusing functionality, and I myself do not yet understand
how to work it and get out of it. 

### Knobs

The (top) Knobs 1-4 control the wet signal (volume level) for the 4 displayed loops.

The (bottom) Knobs 5-8 control the pan of the 4 displayed loops.

## Session mode 1: session save mode

Pressing a pad saves the current session to one of the 40 locations.

Invoke by pressing `[Device]` button once. The `[Device]` button will light up red.

The session path is `"/zynthian/zynthian-my-data/presets/sooperlooper/"` by default. Change it on start-up with the `-P` parameter.

Run `python lib/sessions.py <sessiondir>` to get feedback on which pads have storage.

The last recorded or loaded session by the driver during the current session is indicated by a blinking pad.

## Session mode 2: Session load mode

Pressing a pad loads a session stored under that pad.

Invoke by pressing `[Device]` twice. The `[Device]` button will light pulsate red.

The last recorded or loaded session by the driver during the current session is indicated by a blinking pad.

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

The first 6 pads in the top row toggle sync/relative sync/playback
sync/mute quant/overdub quant/replace quant for all loops.

The pads in the columns below toggle it on individual loops.

Shifting loops is possible as in the default.

The 7th pad in the top row cycle through Sync source (off, loop1 (blue) -- last loop (all dark blue), internal (white), MIDI (orange), Jack (red)).

The (newly) selected function/loop # is indicated in the grid.

The 8th pad in the top row cycle through Sync to (off, MIDI(orange), 8th(brown), cycle(blue)).

The two light brown pads below the top row increase/decrease the
number of 8th within a cycle. Press both at same time to view but not change.

While one of those is pressed, number of 8ths is indicated as brown
pads filling up from the left bottom. Pressing ANY pad sets it to that
number of 8ths. This allows for easy setting of e.g. 4/8 or 2/8, so
that you easily create smaller loops than the one synced to, yet still
be in time. Their own placement--at 23/8 and 31/8--is large prime enough not
likely to pose a problem.

