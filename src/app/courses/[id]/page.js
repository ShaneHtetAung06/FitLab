import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Course from '@/models/Course';
import CourseDetail from './CourseDetail';

/**
 * Reads just enough of the course to build page metadata.
 *
 * Runs on the server so a shared or crawled course link carries a real title,
 * description and preview image rather than the generic app shell. The
 * interactive body stays client-side because it depends on who is signed in.
 */
async function getCourseMeta(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  try {
    await dbConnect();

    return await Course.findOne({ _id: id, isPublished: true })
      .select('title description thumbnail price category level')
      .lean();
  } catch (error) {
    // Metadata is not worth failing the page render over.
    console.error('Course metadata error:', error);
    return null;
  }
}

export async function generateMetadata({ params }) {
  const course = await getCourseMeta(params.id);

  if (!course) {
    return {
      title: 'Course · FitLab',
      description: 'Browse fitness courses from certified trainers on FitLab.',
    };
  }

  const description = (course.description || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  return {
    title: `${course.title} · FitLab`,
    description,
    openGraph: {
      title: course.title,
      description,
      type: 'website',
      ...(course.thumbnail ? { images: [{ url: course.thumbnail }] } : {}),
    },
    twitter: {
      card: course.thumbnail ? 'summary_large_image' : 'summary',
      title: course.title,
      description,
      ...(course.thumbnail ? { images: [course.thumbnail] } : {}),
    },
  };
}

export default function CourseDetailPage() {
  return <CourseDetail />;
}
