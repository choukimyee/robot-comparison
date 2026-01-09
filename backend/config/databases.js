import dotenv from 'dotenv';
dotenv.config();

export const databases = {
  Humanoid: {
    id: process.env.DB_HUMANOID,
    icon: '🤖',
    specGroups: [
      { id: 'overview', name: 'Overview', icon: '📐', specs: ['Height', 'Weight', 'Total DOF'], better: ['', 'min', 'max'] },
      { id: 'performance', name: 'Performance', icon: '⚡', specs: ['Navigation Max', 'Payload', 'IP Rating'], better: ['max', 'max', ''] },
      { id: 'power', name: 'Power', icon: '🔋', specs: ['Runtime', 'Battery', 'Charge Time'], better: ['max', 'max', 'min'] },
      { id: 'intelligence', name: 'Intelligence', icon: '🧠', specs: ['Chip', 'Computing', 'Sensors'], better: ['', 'max', ''] },
    ]
  },
  Quadruped: {
    id: process.env.DB_QUADRUPED,
    icon: '🐕',
    specGroups: [
      { id: 'overview', name: 'Overview', icon: '📐', specs: ['Length', 'Height', 'Weight'], better: ['', '', 'min'] },
      { id: 'performance', name: 'Performance', icon: '⚡', specs: ['Max Speed', 'Payload', 'IP Rating'], better: ['max', 'max', ''] },
      { id: 'power', name: 'Power', icon: '🔋', specs: ['Runtime', 'Battery'], better: ['max', 'max'] },
    ]
  },
  Vacuum: {
    id: process.env.DB_VACUUM,
    icon: '🧹',
    specGroups: [
      { id: 'overview', name: 'Overview', icon: '📐', specs: ['Diameter', 'Height', 'Weight'], better: ['min', 'min', 'min'] },
      { id: 'performance', name: 'Performance', icon: '⚡', specs: ['Suction Power', 'Mopping', 'Navigation Type'], better: ['max', '', ''] },
      { id: 'power', name: 'Power', icon: '🔋', specs: ['Runtime'], better: ['max'] },
    ]
  },
  'Pool Cleaner': {
    id: process.env.DB_POOL_CLEANER,
    icon: '🏊',
    specGroups: [
      { id: 'overview', name: 'Overview', icon: '📐', specs: ['Weight'], better: ['min'] },
      { id: 'performance', name: 'Performance', icon: '⚡', specs: ['Coverage'], better: ['max'] },
    ]
  },
  'Lawn Mower': {
    id: process.env.DB_LAWN_MOWER,
    icon: '🌿',
    specGroups: [
      { id: 'overview', name: 'Overview', icon: '📐', specs: ['Weight'], better: ['min'] },
      { id: 'performance', name: 'Performance', icon: '⚡', specs: ['Coverage'], better: ['max'] },
    ]
  },
  Industrial: {
    id: process.env.DB_INDUSTRIAL,
    icon: '🏭',
    specGroups: [
      { id: 'overview', name: 'Overview', icon: '📐', specs: ['Reach', 'Weight', 'Axes'], better: ['max', 'min', 'max'] },
      { id: 'performance', name: 'Performance', icon: '⚡', specs: ['Payload', 'Repeatability'], better: ['max', 'min'] },
    ]
  },
  Wheeled: {
    id: process.env.DB_WHEELED,
    icon: '🦿',
    specGroups: [
      { id: 'overview', name: 'Overview', icon: '📐', specs: ['Weight'], better: ['min'] },
    ]
  },
  Companion: {
    id: process.env.DB_COMPANION,
    icon: '🤗',
    specGroups: [
      { id: 'overview', name: 'Overview', icon: '📐', specs: ['Weight'], better: ['min'] },
    ]
  },
  Drone: {
    id: process.env.DB_DRONE,
    icon: '🚁',
    specGroups: [
      { id: 'overview', name: 'Overview', icon: '📐', specs: ['Weight', 'Foldable'], better: ['min', ''] },
      { id: 'performance', name: 'Performance', icon: '⚡', specs: ['Max Speed', 'Max Range'], better: ['max', 'max'] },
      { id: 'power', name: 'Power', icon: '🔋', specs: ['Flight Time'], better: ['max'] },
      { id: 'camera', name: 'Camera', icon: '📷', specs: ['Camera Resolution', 'Video Resolution'], better: ['', ''] },
    ]
  },
  Others: {
    id: process.env.DB_OTHERS,
    icon: '📦',
    specGroups: []
  }
};
config: {
  id: process.env.DB_CONFIG
}
