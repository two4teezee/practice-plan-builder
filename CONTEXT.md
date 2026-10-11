# Practice Plan Builder

Coaches build hockey practice plans by arranging drills from a shared drill library into a timed sequence.

## Language

### Drills

**Drill**:
A reusable exercise in the drill library, with its setup, coaching points, sketch and default duration.
_Avoid_: Exercise, activity

**Category**:
The single type a Drill belongs to (Skating, Goalie, Small Game…).
_Avoid_: Drill type, skill focus

### Practices

**Practice Plan**:
A dated, timed sequence of Drills and Splits for one team session.
_Avoid_: Practice, session plan

**Practice Override**:
A change to a Drill's content that applies only within one Practice Plan; the library Drill is untouched.
_Avoid_: Custom drill, local edit

**Split**:
A block of a Practice Plan where the team divides into Groups that run at the same time; it ends when the longest Group finishes.
_Avoid_: Parallel, parallel split, branch

**Group**:
One track inside a Split, with its own sequence of Drills.
_Avoid_: Track, station, lane

**Run alongside**:
The action that turns a single Drill into a Split by adding a second Group with another Drill.
_Avoid_: Concurrent drill, side drill
