import Dexie, { type EntityTable } from 'dexie';
import type { Drill, PracticePlan } from './types';

const db = new Dexie('HockeyPracticePlanner') as Dexie & {
  drills: EntityTable<Drill, 'id'>;
  practicePlans: EntityTable<PracticePlan, 'id'>;
};

db.version(1).stores({
  drills: '++id, name, category, skillFocus, createdAt',
  practicePlans: '++id, name, date, coach, createdAt',
});

export { db };

// Seed data for initial drills
export const seedDrills: Omit<Drill, 'id'>[] = [
  {
    name: 'Warm-up Skating',
    category: 'Skating',
    duration: '5:00',
    skillFocus: 'Skating',
    objective: 'Get players warmed up and ready for practice',
    setup: 'Players line up on the goal line',
    execution: 'Skate around the rink with various skating techniques: forward, backward, crossovers',
    coachingPoints: 'Focus on proper skating form, knee bend, and arm movement',
    variations: 'Add puck handling, increase speed, add stops and starts',
    equipment: 'None',
    description: 'Basic warm-up skating drill to get blood flowing',
    videoLink: '',
    pdfLink: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Two-Line Passing',
    category: 'Passing',
    duration: '10:00',
    skillFocus: 'Passing',
    objective: 'Improve passing accuracy and receiving skills',
    setup: 'Two lines facing each other at center ice, 20 feet apart',
    execution: 'Pass back and forth, focusing on tape-to-tape passes',
    coachingPoints: 'Cup the puck on reception, follow through on passes, eyes up',
    variations: 'Increase distance, add movement, use saucer passes',
    equipment: 'Pucks',
    description: 'Classic passing drill for all skill levels',
    videoLink: '',
    pdfLink: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Shooting Stations',
    category: 'Shooting',
    duration: '15:00',
    skillFocus: 'Shooting',
    objective: 'Practice various shot types from different positions',
    setup: 'Set up 4 stations around the offensive zone with puck piles',
    execution: 'Rotate through stations taking wrist shots, slap shots, snap shots, and one-timers',
    coachingPoints: 'Quick release, pick corners, follow through toward target',
    variations: 'Add defenders, time limit per station, competition between groups',
    equipment: 'Pucks, Cones, Nets',
    description: 'Multi-station shooting drill for comprehensive shooting practice',
    videoLink: '',
    pdfLink: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Box Drill',
    category: 'Defensive',
    duration: '8:00',
    skillFocus: 'Defensive',
    objective: 'Practice defensive positioning and gap control',
    setup: 'Create a box with 4 cones in the neutral zone',
    execution: 'Defender skates backward maintaining proper gap while attacker tries to enter the box',
    coachingPoints: 'Stay between attacker and net, stick on ice, active feet',
    variations: 'Add second attacker, allow breakouts, add puck',
    equipment: 'Cones, Pucks',
    description: 'Defensive positioning drill emphasizing gap control',
    videoLink: '',
    pdfLink: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: '2-on-1 Rush',
    category: 'Offensive',
    duration: '12:00',
    skillFocus: 'Offensive',
    objective: 'Practice 2-on-1 situations with quick decision making',
    setup: 'Two lines at center ice, one defender at blue line',
    execution: 'Two forwards attack against one defender, focus on give-and-go or shot',
    coachingPoints: 'Read the defender, make quick decisions, shoot if lane is open',
    variations: '3-on-2, add backchecker, start from different positions',
    equipment: 'Pucks',
    description: 'Classic odd-man rush drill for offensive creativity',
    videoLink: '',
    pdfLink: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Figure 8 Skating',
    category: 'Skating',
    duration: '6:00',
    skillFocus: 'Skating',
    objective: 'Improve edge work and crossovers',
    setup: 'Place two cones 30 feet apart at center ice',
    execution: 'Skate figure 8 patterns around the cones using crossovers',
    coachingPoints: 'Deep knee bend on crossovers, push with both edges, keep head up',
    variations: 'Add puck, change direction, increase speed',
    equipment: 'Cones',
    description: 'Edge work and crossover development drill',
    videoLink: '',
    pdfLink: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function initializeDatabase() {
  const count = await db.drills.count();
  if (count === 0) {
    await db.drills.bulkAdd(seedDrills);
  }
}
