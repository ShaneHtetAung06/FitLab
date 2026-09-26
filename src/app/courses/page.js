'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import CourseCard from '@/components/CourseCard';
import Reveal from '@/components/Reveal';
import { COURSE_CATEGORIES, COURSE_LEVELS, formatPrice } from '@/lib/courseOptions';

// Long enough that a normal typing burst produces one request rather than one
// per keystroke, short enough that results feel like they follow the typing.
const SEARCH_DEBOUNCE_MS = 400;

const SORTS = [
  { value: 'popular', label: 'Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

/**
 * Radio row used by the sidebar facets.
 *
 * A real radio input carries the keyboard and screen-reader behaviour; the
 * visible box is a sibling span driven by `peer-checked`.
 */
function FacetOption({ name, value, checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-[3px] border border-ink-300 transition-[background-color,border-color,transform] duration-200 ease-soft peer-checked:scale-110 peer-checked:border-ink-900 peer-checked:bg-ink-900 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-1"
        aria-hidden="true"
      />
      <span className="text-[13px] text-ink-500 transition-colors peer-checked:font-medium peer-checked:text-ink-900">
        {label}
      </span>
    </label>
  );
}

function FacetGroup({ title, children }) {
  return (
    <div>
      <h2 className="text-[11px] font-bold uppercase tracking-eyebrow text-ink-900">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function CatalogueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The URL is the source of truth so filters survive a refresh and can be
  // shared or linked to, which is what the home page category chips rely on.
  const category = searchParams.get('category') || 'all';
  const level = searchParams.get('level') || 'all';
  const sort = searchParams.get('sort') || 'popular';
  const search = searchParams.get('search') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [searchDraft, setSearchDraft] = useState(search);
  const [courses, setCourses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [priceCeiling, setPriceCeiling] = useState(0);
  const [priceDraft, setPriceDraft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setPriceDraft(null);
  }, [maxPrice]);

  const updateParams = useCallback(
    (changes, { replace = false } = {}) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(changes)) {
        if (value === '' || value === null || value === undefined || value === 'all') {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }

      // Any filter change invalidates the current page number.
      if (!('page' in changes)) params.delete('page');

      const url = `/courses${params.toString() ? `?${params.toString()}` : ''}`;

      // Debounced typing replaces the entry instead of pushing, otherwise every
      // pause while typing "powerlifting" would become its own back-button step.
      if (replace) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [router, searchParams]
  );

  /**
   * Adopt the URL's search term when it changes from outside the input: the back
   * button, "Clear all filters", or a category link from the home page.
   *
   * Guarded on the trimmed value so a debounced round trip does not rewrite what
   * is in the box mid-sentence, which would eat trailing spaces and move the
   * caret while someone is still typing.
   */
  useEffect(() => {
    setSearchDraft((current) => (current.trim() === search ? current : search));
  }, [search]);

  /**
   * Pushes the typed term into the URL once typing settles. The URL stays the
   * single source of truth, so the existing fetch effect picks the change up and
   * the result is still linkable and survives a refresh.
   */
  useEffect(() => {
    const trimmed = searchDraft.trim();
    if (trimmed === search) return undefined;

    const timer = setTimeout(
      () => updateParams({ search: trimmed }, { replace: true }),
      SEARCH_DEBOUNCE_MS
    );

    return () => clearTimeout(timer);
  }, [searchDraft, search, updateParams]);

  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '12', sort });
      if (category !== 'all') params.set('category', category);
      if (level !== 'all') params.set('level', level);
      if (search) params.set('search', search);
      if (maxPrice) params.set('maxPrice', maxPrice);

      const res = await fetch(`/api/courses?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setCourses(data.courses);
        setPagination(data.pagination);
        setPriceCeiling(data.priceCeiling || 0);
      } else {
        toast.error(data.message || 'Could not load courses');
      }
    } catch (error) {
      toast.error('Could not load courses');
    } finally {
      setIsLoading(false);
    }
  }, [page, sort, category, level, search, maxPrice]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const hasFilters =
    category !== 'all' || level !== 'all' || Boolean(search) || Boolean(maxPrice);

  // Only the very first fetch gets a full-height spinner. Later ones dim the
  // results in place, which matters once search fires as you type.
  const isFirstLoad = isLoading && courses.length === 0;

  const clearFilters = () =>
    updateParams({ category: '', level: '', search: '', maxPrice: '', sort: '' });

  // While dragging, the slider follows the finger; the URL only updates on release.
  const sliderValue = priceDraft ?? (maxPrice ? Number(maxPrice) : priceCeiling);

  const filters = (
    <div className="space-y-7">
      <FacetGroup title="Category">
        <FacetOption
          name="category"
          value="all"
          label="All"
          checked={category === 'all'}
          onChange={(value) => updateParams({ category: value })}
        />
        {COURSE_CATEGORIES.map((item) => (
          <FacetOption
            key={item}
            name="category"
            value={item}
            label={item}
            checked={category === item}
            onChange={(value) => updateParams({ category: value })}
          />
        ))}
      </FacetGroup>

      <FacetGroup title="Level">
        <FacetOption
          name="level"
          value="all"
          label="All levels"
          checked={level === 'all'}
          onChange={(value) => updateParams({ level: value })}
        />
        {COURSE_LEVELS.map((item) => (
          <FacetOption
            key={item}
            name="level"
            value={item}
            label={item}
            checked={level === item}
            onChange={(value) => updateParams({ level: value })}
          />
        ))}
      </FacetGroup>

      {/* Hidden when every course is free, where a price ceiling means nothing. */}
      {priceCeiling > 0 && (
        <FacetGroup title="Max price">
          <label htmlFor="price-ceiling" className="sr-only">
            Maximum price
          </label>
          <input
            id="price-ceiling"
            type="range"
            min={0}
            max={priceCeiling}
            step={1}
            value={sliderValue}
            onChange={(event) => setPriceDraft(Number(event.target.value))}
            onPointerUp={() =>
              updateParams({
                maxPrice: sliderValue >= priceCeiling ? '' : sliderValue,
              })
            }
            onKeyUp={() =>
              updateParams({
                maxPrice: sliderValue >= priceCeiling ? '' : sliderValue,
              })
            }
            className="range-brand"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-ink-400">
            <span>{formatPrice(0)}</span>
            <span>{formatPrice(priceCeiling)}</span>
          </div>
          <p className="mt-1.5 text-[12px] text-ink-500">
            Showing courses under {formatPrice(sliderValue)}
          </p>
        </FacetGroup>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="text-[13px] font-semibold text-primary-600 hover:text-primary-700"
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div>
        <p className="eyebrow">Explore</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">All Courses</h1>
        <p className="mt-2 text-[15px] text-ink-500">
          {pagination.total} course{pagination.total === 1 ? '' : 's'} from elite trainers
          across every discipline
        </p>
      </div>

      {/* Search + sort */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <form
          onSubmit={(event) => {
            // Results already follow the typing; Enter just skips the wait.
            event.preventDefault();
            updateParams({ search: searchDraft.trim() });
          }}
          className="relative flex-1"
          role="search"
        >
          <label htmlFor="course-search" className="sr-only">
            Search courses
          </label>
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
            />
          </svg>
          <input
            id="course-search"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search courses, categories…"
            autoComplete="off"
            className="field pl-10"
          />
        </form>

        <div className="relative sm:w-52">
          <label htmlFor="filter-sort" className="sr-only">
            Sort by
          </label>
          <select
            id="filter-sort"
            value={sort}
            onChange={(event) => updateParams({ sort: event.target.value })}
            className="field cursor-pointer appearance-none pr-10"
          >
            {SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Mobile filter toggle. The sidebar is always present on desktop. */}
      <button
        type="button"
        onClick={() => setFiltersOpen((open) => !open)}
        aria-expanded={filtersOpen}
        className="btn btn-outline btn-sm mt-3 w-full lg:hidden"
      >
        {filtersOpen ? 'Hide filters' : 'Show filters'}
        {hasFilters && !filtersOpen && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary-600" aria-hidden="true" />
        )}
      </button>

      <div className="mt-8 grid gap-10 lg:grid-cols-[13rem_1fr]">
        {/* The mobile disclosure animates in; on desktop the sidebar is simply
            always there, so it is excluded from the entrance. */}
        <aside
          className={
            filtersOpen ? 'block animate-fade-up-sm lg:animate-none' : 'hidden lg:block'
          }
        >
          <div className="lg:sticky lg:top-24">{filters}</div>
        </aside>

        <div>
          {/* aria-live so a screen reader hears the new count after a debounced
              search, since nothing receives focus when the results change. */}
          <p className="text-[13px] text-ink-500" aria-live="polite">
            {isLoading ? (
              'Searching…'
            ) : (
              <>
                {pagination.total} course{pagination.total === 1 ? '' : 's'} found
                {search && (
                  <>
                    {' '}
                    for <span className="font-medium text-ink-900">“{search}”</span>
                  </>
                )}
              </>
            )}
          </p>

          {isFirstLoad ? (
            <div className="flex justify-center py-24">
              <div className="spinner h-10 w-10" />
            </div>
          ) : courses.length === 0 ? (
            <Reveal className="card mt-4 p-12 text-center">
              <h2 className="display text-xl">No courses found</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
                {hasFilters
                  ? 'Try widening your search or clearing the filters.'
                  : 'No courses have been published yet. Check back soon.'}
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="btn btn-primary btn-sm mt-5"
                >
                  Clear filters
                </button>
              )}
            </Reveal>
          ) : (
            <>
              {/* Refetches dim the existing grid rather than replacing it with a
                  spinner, so the layout does not jump on every keystroke burst.
                  The reveal only runs once, so results that arrive from a later
                  search swap in immediately instead of staggering again. */}
              <Reveal
                stagger
                aria-busy={isLoading}
                className={`mt-4 grid gap-6 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${
                  isLoading ? 'opacity-40' : 'opacity-100'
                }`}
              >
                {courses.map((course) => (
                  <CourseCard key={course._id} course={course} />
                ))}
              </Reveal>

              {pagination.totalPages > 1 && (
                <nav
                  className="mt-10 flex items-center justify-center gap-4"
                  aria-label="Pagination"
                >
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => updateParams({ page: page - 1 })}
                    className="btn btn-outline btn-sm"
                  >
                    Previous
                  </button>
                  <span className="text-[13px] text-ink-500">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pagination.totalPages}
                    onClick={() => updateParams({ page: page + 1 })}
                    className="btn btn-outline btn-sm"
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  // useSearchParams needs a Suspense boundary during prerendering.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="spinner h-10 w-10" />
        </div>
      }
    >
      <CatalogueContent />
    </Suspense>
  );
}
