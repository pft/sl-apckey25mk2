# Usage

There are three main device modes. The `Device` button cycles between them:

1. Looper mode
2. Session save mode
3. Session/loop(@todo) load mode

## 1. Looper mode

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
