import Link from 'next/link';
import Image from 'next/image';
import dbConnect from '@/lib/db';
import Course from '@/models/Course';
import Enrollment from '@/models/Enrollment';
import User from '@/models/User';
import CourseCard from '@/components/CourseCard';
import CountUp from '@/components/CountUp';
import Reveal from '@/components/Reveal';
import HomeCTAButtons from '@/components/HomeCTAButtons';
import { summarizeCurriculum } from '@/lib/courseOptions';

// The landing page reads live figures, so it is regenerated periodically rather
// than on every request. Keeps the marketing numbers honest without putting the
// database in the path of every visit.
export const revalidate = 300;

const EMPTY = {
  courses: [],
  coaches: [],
  stats: { students: 0, courses: 0, trainers: 0 },
  rating: { average: 0, reviews: 0 },
};

/**
 * Everything the landing page shows, in one round of queries.
 *
 * Wrapped so a database hiccup degrades the page to its static copy instead of
 * failing the render, which also keeps `next build` from depending on a
 * reachable database.
 */
async function getHomeData() {
  try {
    await dbConnect();

    const [courses, students, courseCount, trainers, ratingAgg, coachAgg] =
      await Promise.all([
        Course.find({ isPublished: true })
          .select(
            'title description thumbnail price category level sections trainer averageRating totalReviews totalEnrollments'
          )
          .populate('trainer', 'name avatar')
          .sort({ totalEnrollments: -1, averageRating: -1, publishedAt: -1 })
          .limit(6)
          .lean(),

        Enrollment.countDocuments({ status: { $in: ['active', 'completed'] } }),
        Course.countDocuments({ isPublished: true }),
        User.countDocuments({ role: 'trainer', isActive: { $ne: false } }),

        // Weighted so a course with 400 reviews counts more than one with 2.
        Course.aggregate([
          { $match: { isPublished: true, totalReviews: { $gt: 0 } } },
          {
            $group: {
              _id: null,
              weighted: { $sum: { $multiply: ['$averageRating', '$totalReviews'] } },
              reviews: { $sum: '$totalReviews' },
            },
          },
        ]),

        Course.aggregate([
          { $match: { isPublished: true } },
          {
            $group: {
              _id: '$trainer',
              courses: { $sum: 1 },
              students: { $sum: '$totalEnrollments' },
              weighted: { $sum: { $multiply: ['$averageRating', '$totalReviews'] } },
              reviews: { $sum: '$totalReviews' },
            },
          },
          { $sort: { students: -1, courses: -1 } },
          { $limit: 4 },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'trainer',
            },
          },
          { $unwind: '$trainer' },
        ]),
      ]);

    const ratingRow = ratingAgg[0];

    return {
      // Virtuals do not survive .lean(), so the curriculum totals are attached here.
      courses: courses.map(({ sections, ...course }) => ({
        ...course,
        _id: String(course._id),
        trainer: course.trainer
          ? { ...course.trainer, _id: String(course.trainer._id) }
          : null,
        ...summarizeCurriculum(sections),
      })),
      coaches: coachAgg.map((row) => ({
        _id: String(row._id),
        name: row.trainer?.name || 'Trainer',
        avatar: row.trainer?.avatar || '',
        bio: row.trainer?.bio || '',
        courses: row.courses,
        students: row.students,
        rating: row.reviews > 0 ? row.weighted / row.reviews : 0,
        reviews: row.reviews,
      })),
      stats: { students, courses: courseCount, trainers },
      rating: {
        average: ratingRow?.reviews > 0 ? ratingRow.weighted / ratingRow.reviews : 0,
        reviews: ratingRow?.reviews || 0,
      },
    };
  } catch (error) {
    console.error('Home page data error:', error);
    return EMPTY;
  }
}

/** Adds a "+" only once a number is big enough for it to read as an approximation. */
function approx(value) {
  const number = Number(value) || 0;
  return number >= 100 ? `${number.toLocaleString('en-US')}+` : String(number);
}

/** @param {boolean} [plus] mark the figure as an approximation, as `approx` does */
function Stat({ value, label, plus = false }) {
  return (
    <div>
      <p className="display text-2xl sm:text-3xl">
        {/* Counts up the first time it is seen. The figure itself is still what
            gets server-rendered, so the markup never depends on the animation. */}
        <CountUp value={value} suffix={plus && value >= 100 ? '+' : ''} />
      </p>
      <p className="mt-1 text-xs text-ink-500">{label}</p>
    </div>
  );
}

export default async function Home() {
  const { courses, coaches, stats, rating } = await getHomeData();

  const hero = courses[0] || null;
  const categories = [...new Set(courses.map((course) => course.category))].slice(0, 6);

  const principles = [
    {
      title: 'Coaches, not influencers',
      body: 'Every trainer is reviewed and approved before they can publish. No shortcuts, no rented credibility.',
    },
    {
      title: 'Programmes, not playlists',
      body: 'Courses are built in sections and lessons that progress deliberately, so you always know what comes next.',
    },
    {
      title: 'Answers from your coach',
      body: 'Enrolling opens a direct line to the trainer who wrote the course. Ask, adjust, keep going.',
    },
  ];

  return (
    <div>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="border-b border-ink-100">
        <div className="mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* The hero is above the fold on every visit, so it introduces
                itself on load with plain CSS rather than waiting for an observer
                to tell it what it already knows. Delays cascade down the column. */}
            <div>
              <p className="flex animate-fade-in items-center gap-3">
                <span
                  className="h-px w-7 origin-left animate-draw-x bg-primary-600 [animation-delay:200ms]"
                  aria-hidden="true"
                />
                <span className="eyebrow">Premium fitness education</span>
              </p>

              <h1 className="mt-6 font-display text-5xl font-bold leading-[0.92] tracking-tight text-ink-900 sm:text-6xl lg:text-7xl">
                <span className="block animate-fade-up [animation-delay:60ms]">
                  FORGED
                </span>
                <span className="mt-1 block animate-fade-up font-normal italic text-ink-300 [animation-delay:150ms]">
                  by
                </span>
                <span className="block animate-fade-up [animation-delay:240ms]">
                  EXPERTS.
                </span>
              </h1>

              <p className="mt-6 max-w-md animate-fade-up text-[15px] leading-relaxed text-ink-600 [animation-delay:340ms]">
                Learn from elite trainers who have lived what they teach — structured
                courses designed for people serious about results, not inspiration.
              </p>

              <div className="mt-8 flex animate-fade-up flex-wrap gap-3 [animation-delay:420ms]">
                <Link href="/courses" className="btn btn-primary">
                  Browse Courses
                </Link>
                <Link href="#coaches" className="btn btn-outline">
                  Meet the coaches
                </Link>
              </div>

              <div className="mt-12 flex animate-fade-up items-end gap-6 [animation-delay:500ms] sm:gap-10">
                <Stat value={stats.students} plus label="Students enrolled" />
                <span className="h-10 w-px bg-ink-200" aria-hidden="true" />
                <Stat value={stats.courses} label="Expert courses" />
                <span className="h-10 w-px bg-ink-200" aria-hidden="true" />
                <Stat value={stats.trainers} label="Verified trainers" />
              </div>
            </div>

            {/* Hero visual, built from the most popular course so the floating
                cards show real figures rather than decorative placeholders. */}
            <div className="relative animate-fade-in [animation-delay:150ms]">
              <div className="relative ml-auto aspect-[4/3] w-full overflow-hidden rounded-card bg-bone lg:aspect-[5/4]">
                {hero?.thumbnail ? (
                  <Image
                    src={hero.thumbnail}
                    alt=""
                    fill
                    priority
                    // Drifts almost imperceptibly so the largest element on the
                    // page is never completely still.
                    className="animate-kenburns object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-primary-800">
                    <span className="text-6xl opacity-90" aria-hidden="true">
                      🏋️
                    </span>
                  </div>
                )}
              </div>

              {/* Position on the wrapper, motion on the card: the two cards bob
                  on different cycles so they never look mechanically linked. */}
              {rating.reviews > 0 && (
                <div className="absolute -left-2 top-6 animate-fade-up [animation-delay:560ms] sm:left-0 lg:-left-10">
                  <div className="animate-float-slow rounded-card border border-ink-100 bg-white p-4 shadow-float">
                    <p className="text-[11px] text-ink-500">Average rating</p>
                    <p className="display mt-0.5 flex items-baseline gap-1 text-2xl">
                      <CountUp value={rating.average} decimals={1} />
                      <span className="text-sm text-primary-600" aria-hidden="true">
                        ★
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-400">
                      from {approx(rating.reviews)} reviews
                    </p>
                  </div>
                </div>
              )}

              {hero && (
                <div className="absolute -bottom-6 left-2 animate-fade-up [animation-delay:660ms] sm:left-6 lg:-left-12">
                  <div className="w-[17rem] animate-float rounded-card border border-ink-100 bg-white p-4 shadow-float">
                    <div className="flex items-center gap-2.5">
                      <span className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-full bg-primary-50">
                        {hero.trainer?.avatar ? (
                          <Image
                            src={hero.trainer.avatar}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="32px"
                            unoptimized
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs font-bold text-primary-700">
                            {hero.trainer?.name?.charAt(0).toUpperCase() || 'F'}
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink-900">
                          {hero.trainer?.name || 'FitLab trainer'}
                        </p>
                        <p className="text-[11px] text-ink-400">Most enrolled course</p>
                      </div>
                    </div>

                    <p className="mt-3 truncate text-[13px] font-semibold text-primary-600">
                      {hero.title}
                    </p>

                    <div
                      className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100"
                      role="img"
                      aria-label={`Rated ${hero.averageRating?.toFixed(1) || 0} out of 5`}
                    >
                      {/* Grows to its real width on load. The width is still set
                          inline, so the bar is correct without the animation. */}
                      <div
                        className="bar-fill h-full rounded-full bg-primary-600 [animation-delay:900ms]"
                        style={{
                          '--bar-width': `${Math.max(
                            4,
                            ((hero.averageRating || 0) / 5) * 100
                          )}%`,
                          width: `${Math.max(
                            4,
                            ((hero.averageRating || 0) / 5) * 100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-ink-400">
                      {hero.totalEnrollments || 0} enrolled
                      {hero.totalReviews > 0 &&
                        ` · ★ ${hero.averageRating.toFixed(1)} from ${hero.totalReviews} reviews`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Featured courses */}
      <section className="mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Featured</p>
            <h2 className="display mt-2 text-3xl sm:text-4xl">Expert Courses</h2>
          </div>
          <Link
            href="/courses"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-primary-600"
          >
            View all {stats.courses} course{stats.courses === 1 ? '' : 's'}
            <span
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            >
              →
            </span>
          </Link>
        </Reveal>

        {categories.length > 0 && (
          // Links rather than client-side filters: they land on the catalogue
          // with the filter already applied, and keep this page free of JS.
          <Reveal stagger className="mt-6 flex flex-wrap gap-2">
            <Link href="/courses" className="pill pill-active">
              All
            </Link>
            {categories.map((category) => (
              <Link
                key={category}
                href={`/courses?category=${encodeURIComponent(category)}`}
                className="pill"
              >
                {category}
              </Link>
            ))}
          </Reveal>
        )}

        {courses.length === 0 ? (
          <Reveal className="mt-10 card p-12 text-center">
            <h3 className="display text-xl">No courses published yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
              The catalogue is being built. Trainers are preparing their first
              programmes.
            </p>
          </Reveal>
        ) : (
          // The cards stay server components; only this wrapper is client-side.
          <Reveal stagger className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course._id} course={course} />
            ))}
          </Reveal>
        )}
      </section>

      {/* ------------------------------------------------------------- Coaches */}
      <section id="coaches" className="scroll-mt-20 border-y border-ink-100 bg-bone">
        <div className="mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <Reveal className="text-center">
            <p className="eyebrow">The coaches</p>
            <h2 className="display mt-2 text-3xl sm:text-4xl">Learn from the Best</h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] text-ink-600">
              Approved trainers with real programmes and real students behind them.
            </p>
          </Reveal>

          {coaches.length === 0 ? (
            <p className="mt-10 text-center text-sm text-ink-500">
              Trainer profiles will appear here as coaches publish their courses.
            </p>
          ) : (
            <Reveal stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {coaches.map((coach) => (
                <article key={coach._id} className="group card p-5 text-center">
                  <span className="relative mx-auto block h-16 w-16 overflow-hidden rounded-full bg-primary-50 transition-transform duration-500 ease-soft group-hover:scale-105">
                    {coach.avatar ? (
                      <Image
                        src={coach.avatar}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="64px"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-display text-xl font-bold text-primary-700">
                        {coach.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>

                  <h3 className="mt-3 font-display text-base font-bold text-ink-900">
                    {coach.name}
                  </h3>

                  {coach.reviews > 0 ? (
                    <p className="mt-0.5 text-xs text-ink-500">
                      <span className="text-primary-600" aria-hidden="true">
                        ★
                      </span>{' '}
                      {coach.rating.toFixed(1)} · {coach.reviews} review
                      {coach.reviews === 1 ? '' : 's'}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-ink-400">New coach</p>
                  )}

                  {coach.bio && (
                    <p className="mt-2.5 line-clamp-3 text-[13px] leading-relaxed text-ink-500">
                      {coach.bio}
                    </p>
                  )}

                  <p className="mt-3 border-t border-ink-100 pt-3 text-[11px] uppercase tracking-wider text-ink-400">
                    {coach.courses} course{coach.courses === 1 ? '' : 's'} ·{' '}
                    {coach.students.toLocaleString('en-US')} student
                    {coach.students === 1 ? '' : 's'}
                  </p>
                </article>
              ))}
            </Reveal>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------- Principles */}
      <section className="mx-auto max-w-shell px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="max-w-xl">
          <p className="eyebrow">Why FitLab</p>
          <h2 className="display mt-2 text-3xl sm:text-4xl">
            Built for people who finish what they start.
          </h2>
        </Reveal>

        {/* Revealed as one block rather than per panel: the hairlines between
            these cells are the background showing through a 1px gap, and sliding
            the panels individually would flash those seams open. */}
        <Reveal
          delay={80}
          className="mt-10 grid gap-px overflow-hidden rounded-card border border-ink-100 bg-ink-100 sm:grid-cols-3"
        >
          {principles.map((item, index) => (
            <div key={item.title} className="group bg-white p-6 lg:p-8">
              <p className="font-display text-2xl font-bold text-primary-600 transition-transform duration-500 ease-soft group-hover:-translate-y-0.5">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-3 font-display text-lg font-bold text-ink-900">
                {item.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-500">{item.body}</p>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ----------------------------------------------------------------- CTA */}
      <section className="bg-ink-900">
        <Reveal className="mx-auto max-w-shell px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
            Stop collecting workouts. Start following a programme.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[15px] text-ink-400">
            Create an account, pick a coach, and train with a plan that actually
            progresses.
          </p>
          <HomeCTAButtons />
        </Reveal>
      </section>
    </div>
  );
}
