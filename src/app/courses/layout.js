/**
 * Metadata for the course area.
 *
 * The catalogue page is a client component and so cannot export metadata
 * itself. Individual course pages override this with their own title and
 * preview image via generateMetadata.
 */
export const metadata = {
  title: 'Browse Courses · FitLab',
  description:
    'Explore fitness courses from certified trainers. Filter by category, level and price, then train at your own pace.',
};

export default function CoursesLayout({ children }) {
  return children;
}
