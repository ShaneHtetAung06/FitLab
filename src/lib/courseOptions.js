

export const COURSE_CATEGORIES = [
  'Strength Training',
  'Cardio',
  'Yoga',
  'Pilates',
  'HIIT',
  'CrossFit',
  'Nutrition',
  'Flexibility',
  'Martial Arts',
  'Dance Fitness',
  'Other',
];

export const COURSE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All Levels'];

export const COURSE_LIMITS = {
  title: 100,
  description: 2000,
  sectionTitle: 200,
  lessonTitle: 200,
  lessonContent: 20000,
  lessonDuration: 1440,
  maxPrice: 100000,
  maxSections: 50,
  maxLessonsPerSection: 100,
};


export function formatPrice(price) {
  const amount = Number(price) || 0;
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}


export function summarizeCurriculum(sections) {
  const list = Array.isArray(sections) ? sections : [];

  let totalLessons = 0;
  let totalDuration = 0;

  for (const section of list) {
    const lessons = Array.isArray(section?.lessons) ? section.lessons : [];
    totalLessons += lessons.length;
    for (const lesson of lessons) {
      totalDuration += Number(lesson?.duration) || 0;
    }
  }

  return { totalSections: list.length, totalLessons, totalDuration };
}

/** Turns a minute count into "3h 20m" style text. */
export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total === 0) return '0m';
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
