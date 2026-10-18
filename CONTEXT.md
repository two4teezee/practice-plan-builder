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

**Attendance**:
Which Players on the Roster are present for one Practice Plan, which Team Group each one practices with that day (it can differ from their Default Group), and whether they're on the Home or Away side (or N/A).
_Avoid_: Check-in, lineup

### Teams

**Team**:
A team managed in the Team Manager, with a Roster and Team Groups. A Practice Plan may link to one.
_Avoid_: Club, squad

**Roster**:
The Players on a Team, coaches included.
_Avoid_: Lineup, player list

**Player**:
One person on a Roster, with a position (Skater, Goalie, Coach or Assistant Coach) and an optional Team Group.
_Avoid_: Athlete, member

**Team Group**:
A named subset of a Team's Roster (Forwards, Red, Line 1…), shown as "Default Group" in the app because it's a preset: Attendance starts each Player in theirs. Its names seed the Group names of a Split in that Team's Practice Plans. Distinct from a Split's **Group**.
_Avoid_: Line, unit
