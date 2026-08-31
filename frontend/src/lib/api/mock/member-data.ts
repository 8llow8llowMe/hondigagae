import type { MockResult } from '@/lib/api/mock/auth-data'
import { memberIdOf } from '@/lib/api/mock/store'
import type { ApiResponse } from '@/types/api'

/**
 * 회원(마이페이지) mock.
 *
 * **지금은 프로필 이미지 업로드 하나만 있다.** 이 저장소 최초의 `multipart/form-data`
 * 요청이라, BFF 의 multipart 통과 경로([#79](https://github.com/8llow8llowMe/hondigagae/issues/79))가
 * 실제로 도착하는지 mock 으로도 확인할 수 있어야 한다.
 *
 * 내 정보 조회·수정·비밀번호·탈퇴는 마이페이지 화면
 * ([#83](https://github.com/8llow8llowMe/hondigagae/issues/83))에서 이 파일에 붙인다.
 *
 * 근거: `MemberWebController.uploadProfileImage` · `MemberProfileImageUploadResponse` 소스 실측.
 * 계약 상세는 docs/features/member/공통명세.md S1.
 */

function ok<T>(dataBody: T): ApiResponse<T> {
  return { dataHeader: { success: true, resultCode: null, resultMessage: null }, dataBody }
}

function fail(status: number, resultCode: string, resultMessage: string): MockResult {
  return {
    status,
    payload: { dataHeader: { success: false, resultCode, resultMessage }, dataBody: null },
  }
}

/**
 * 고정 오브젝트 키. **mock 은 파일을 저장하지 않는다** — 바이너리를 들고 있어 봐야
 * 화면이 확인할 것은 "업로드가 통과했고 URL 이 돌아온다" 뿐이다.
 */
const MOCK_OBJECT_KEY = 'members/profiles/mock/2026/08/3f2a9c11-0e4b-4a1f-9c3d-0b8e2f7a5d61.png'

/**
 * 로컬 MinIO 공개 주소. `application-local.yml` 의
 * `infra.storage.{public-url, bucket}` 을 그대로 옮긴 값이라 형태가 실제와 같다.
 *
 * **`next/image` 허용 호스트에는 없다** — `isAllowedImageHost` 가 false 를 주고 화면은
 * 플레이스홀더로 떨어진다(던지지 않는다). 실제 공개 호스트는 `MINIO_PUBLIC_URL` 환경변수라
 * 소스에 없어서 추측하지 않았다. 등록은 #83 에서 값을 확인한 뒤 한다.
 */
const MOCK_PROFILE_IMAGE_URL = `http://localhost:9000/hondigagae-local/${MOCK_OBJECT_KEY}`

/** 처리 대상이 아니면 null 을 반환해 호출부가 게이트웨이로 넘기게 한다 */
export function resolveMemberMock(
  path: string,
  method: string,
  accessToken: string | null,
): MockResult | null {
  if (path === '/members/me/profile-image' && method === 'POST') {
    // 컨트롤러가 @PreAuthorize("isAuthenticated()") 다. mock 이 더 느슨하면
    // 로그인 없이 되는 화면을 만들어 놓고 실제로는 401 을 맞는다
    if (memberIdOf(accessToken) === null) return fail(401, 'AUTH_011', '인증이 필요합니다.')

    return {
      status: 200,
      payload: ok({
        profileImageKey: MOCK_OBJECT_KEY,
        profileImageUrl: MOCK_PROFILE_IMAGE_URL,
      }),
    }
  }

  return null
}
