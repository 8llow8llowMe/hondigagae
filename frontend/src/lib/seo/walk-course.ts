import { messages } from '@/lib/messages'
import { SITE_NAME } from '@/lib/seo/site'
import type { WalkCourseDetail } from '@/types/walk-course'

/**
 * 올레 코스 상세의 검색 문구 (#1130).
 *
 * 예전에는 29개 코스의 description 이 전부 목록 화면 설명과 같았다. 검색엔진은 같은 설명을
 * 단 페이지들을 서로 구분하지 못하고, 검색 결과에도 코스의 사실(거리·시간)이 나가지 않았다.
 */
export function walkCourseSeoTitle(course: Pick<WalkCourseDetail, 'courseLabel' | 'name'>): string {
  return `${course.courseLabel} ${course.name} ${messages.seo.walkCourseSuffix} · ${SITE_NAME}`
}

/** 예) `제주올레 15코스 (B) · 한림항-고내포구 · 13.5km · 4~5시간 · 활동량 보통 · 높음. 반려견 활동량에…` */
export function walkCourseSeoDescription(
  course: Pick<
    WalkCourseDetail,
    'courseLabel' | 'startEndPoint' | 'distanceKm' | 'durationText' | 'fitsActivityLevels'
  >,
): string {
  const levels = course.fitsActivityLevels.map((level) => level.name)
  const facts = [
    `${messages.seo.walkCourseLabelPrefix} ${course.courseLabel}`,
    course.startEndPoint,
    `${course.distanceKm}km`,
    course.durationText,
    levels.length === 0 ? null : `${messages.seo.walkCourseActivityPrefix} ${levels.join(' · ')}`,
  ].filter((part): part is string => part !== null && part !== '')

  return `${facts.join(' · ')}. ${messages.seo.walkCourseDescriptionTail}`
}
