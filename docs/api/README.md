# 백엔드 API 계약 스냅샷

이 폴더는 **게이트웨이가 실제로 서빙하는 OpenAPI 문서를 파일로 고정해 둔 것**이다.
백엔드가 로컬에 뜨지 않아도 계약을 읽을 수 있고, 계약이 언제 어떻게 바뀌었는지 diff 로 보인다.

수집 시각: **2026-09-19** (dev 게이트웨이).

> **오류 봉투 경고를 지웠다 (#534).** 직전 스냅샷은 `DataHeader.resultMessage` 를
> `{"type":"object"}` 로 적고 `fieldErrors` 키가 없어, 그 항목만 "정본 순서" 를 뒤집어 읽어야
> 했다. 이번 재수집으로 네 서비스 모두 **`resultMessage: string` + `fieldErrors:
> ValidationErrorItem[] | null`** 이 스냅샷에 들어왔다 — 더 이상 예외가 아니다.
> FE 대응은 이미 끝나 있다 (#501 / PR #533).

> **이번 재수집(#723, 2026-09-19)에서 바뀐 것 — plan 이 9개 표면만큼 낡아 있었다.**
>
> - **plan** — `+op` **9개**: 복제 1(`POST /plans/{planId}/copy`) · 공유 링크 3
>   (`GET`·`POST`·`DELETE /plans/{planId}/share-link`) · 공유 열람 1(`GET /shared-plans/{token}`) ·
>   후기 3(`GET`·`POST`·`PUT /plans/{planId}/reviews`) · 산책 위험도 1
>   (`GET /plans/{planId}/walk-safety`). `+schema` 15개.
>   필드로는 `PlanUpdateRequest +petIds`, `PlanItemDetailItem +walkCourse`(#719),
>   `PlanBriefingResponse +weatherWarningUnavailableReasonCode/+walkTimesUnavailableReasonCode`,
>   `PlanBriefingScheduleItem +representativeLat/+representativeLng`,
>   `PlanBriefingItemSummaryItem.itemType: string -> CodeNameDescriptionMetadata`(#716).
> - **tour** — `WalkCourseListResponse +appliedPetActivityLevel / -petActivityLevelApplied`(#718 · #747),
>   `WalkCourseDetailResponse +durationMaxMinutes/+fitsActivityLevels`, `WalkCourseItem +durationMaxMinutes`.
> - **auth** — `MemberGeneralSignupRequest +termsAgreed/+privacyAgreed/+ageOver14Confirmed` (셋 다 `required`).
> - **ai** — 변화 없음.
>
> **여기서도 스냅샷이 낡은 쪽이었다.** #723 본문이 지목한 셋(`POST /plans/{planId}/copy` ·
> `PlanUpdateRequest.petIds` · `GET /plans/{planId}/walk-safety`)이 전부 서버에 실재했고, FE 는
> 스냅샷을 버리고 dev 실호출로 확인해 이미 붙여 둔 상태였다. 새로 들어온 auth 동의 필드 셋도
> 마찬가지다 — `frontend/src/features/auth/schemas.ts` 가 이미 셋을 보내고 있다.
> `goldenWindowStatus` 때와 **같은 종류의 사고**다(아래 2026-09-07 기록).
>
> **이 재수집으로 FE 에 새로 붙일 것은 없다.** 기준선을 맞춘 것까지다.

> 앞선 재수집(#534)에서 바뀐 것 — 네 서비스 전부 + 새 표면 8개.
>
> 공통으로 `DataHeader +fieldErrors` 와 `DataHeader.resultMessage: object -> string`,
> `+schema ValidationErrorItem` 이 들어왔다 (#491). 그 밖에 서비스별로:
>
> - **tour** — `+op GET /walk-courses`, `GET /walk-courses/{walkCourseId}` (산책 코스 2종,
>   **FE 가 존재 자체를 모르던 표면**) · `PlaceCongestionResponse +leastCrowded`
> - **plan** — `+op` 6개 (여행 브리핑 1 · 준비물 5) · `PlanDayWeatherItem +unavailableReasonCode`
> - **ai** — `AiPlanJobStatusResponse +conditions` (`+schema AiPlanJobConditionsResponse`)
> - **auth** — 공통 변경만
>
> **`PlaceCongestionResponse.leastCrowded` 가 서버에 실재하는 것이 확인됐다** —
> [#430](https://github.com/8llow8llowMe/hondigagae/issues/430) 의 남은 절반이 기다리던 필드다.
> 다만 `GET /places/{placeId}/congestions` 자체가 FE 미연동이라 **붙일 화면이 아직 없다**
> (기간 그래프를 둘 자리가 아트보드에 없다 — `frontend/docs/screen-inventory.md`).
>
> **새 표면 8개를 FE 에 연동하지 않는다.** 이 재수집은 기준선을 맞추고 무엇이 생겼는지
> 기록하는 데까지다 — 연동 여부는 화면 이슈로 따로 판단한다.

> 앞선 재수집(#409, 2026-09-10)의 기록: 구조가 바뀐 곳은 **하나뿐이었다** —
> `RegionWeatherItem +maxFeelsLikeTemperature` (tour-service). 권역 비교 행이 체감온도를
> 낼 수 있게 됐다는 뜻이고, [#407](https://github.com/8llow8llowMe/hondigagae/issues/407)
> 이 기다리는 값이기도 하다. **FE 타입에는 아직 없다** — 표시 여부가 #407 의 답에 걸려
> 있어 일부러 안 붙였다 (`features/_index.md` 드리프트 표). 이번 재수집에서도 그대로다.
>
> 그 전(2026-09-07)의 기록: tour-service 셋이었다 (#292) —
> `WalkSafetyResponse +feelsLikeCelsius/+feelsLikeBasis/+heatIndexBasis`,
> `PlaceIntroItem +open24/+openNow`, `WalkTimesResponse +goldenWindowStatus`.
> **`goldenWindowStatus` 는 FE 가 이미 쓰던 필드였다** — 스냅샷만 낡아 있었다. 스냅샷을
> 정본으로 믿고 "없는 필드" 로 판단하면 틀리는 경우가 실제로 있다는 뜻이라 남겨 둔다.

| 파일                                                     | 서비스                                  | operations | schemas |
| -------------------------------------------------------- | --------------------------------------- | ---------- | ------- |
| [`openapi/auth-service.json`](openapi/auth-service.json) | 회원 · 인증/인가                        | 29         | 36      |
| [`openapi/tour-service.json`](openapi/tour-service.json) | 관광 데이터 · 여행 인사이트 · 긴급 시설 | 12         | 45      |
| [`openapi/plan-service.json`](openapi/plan-service.json) | 여행 일정 · 즐겨찾기 · 준비물           | 28         | 62      |
| [`openapi/ai-service.json`](openapi/ai-service.json)     | AI 여행 플래너                          | 5          | 17      |

> **표의 숫자는 스냅샷에서 센다.** 예전 `22` · `8` · `4` 는 아래 인벤토리와도 어긋나 있었다 —
> 표는 손으로 적고 인벤토리는 따로 늘려 온 탓이다. 재수집할 때 이 줄도 함께 고친다.
> `operations` 는 **method × path** 다 (`GET /a` 와 `POST /a` 는 둘).

**정본 순서**: 기동 중인 게이트웨이 Swagger > 이 스냅샷 > 서술 문서(`backend/docs/*.md`).
스냅샷이 낡을 수 있으므로, 계약이 의심되면 아래 명령으로 다시 받아 diff 를 본다.

## 갱신 방법

```bash
for s in ai tour plan auth; do
  curl -s "https://api-dev.hondigagae.com/$s-service/v3/api-docs" \
    | python3 -m json.tool --no-ensure-ascii --indent 2 \
    > "docs/api/openapi/$s-service.json"
done
git diff --stat docs/api/openapi/
```

> ⚠ **경로의 `$s-service` 접두사를 빼면 실패가 성공처럼 보인다.**
> `https://api-dev.hondigagae.com/v3/api-docs` 는 404 가 아니라 **`200` + `"paths": {}`** 를 준다
> (2026-09-19 재확인). 그대로 저장하면 스냅샷이 **빈 스펙으로 덮인다.** #723 이전에 한 레인이
> 이것 때문에 계약 확인을 포기했다.
>
> **받은 뒤 반드시 건수를 확인하고 쓴다** — `paths` 가 0이면 저장하지 않는다:
>
> ```bash
> for s in ai tour plan auth; do
>   curl -s "https://api-dev.hondigagae.com/$s-service/v3/api-docs" \
>     | python3 -c "import json,sys; print('$s-service paths=', len(json.load(sys.stdin).get('paths', {})))"
> done
> ```
>
> **포맷은 2-space 들여쓰기 + 비ASCII 원문 유지다** (`--no-ensure-ascii --indent 2`). 다른 포맷으로
> 저장하면 내용이 같아도 전 줄이 diff 로 잡혀 무엇이 바뀌었는지 못 본다. `python3` 가 없는
> 환경이면 같은 규칙으로 맞춰 주는 도구면 된다 (예: `JSON.stringify(obj, null, 2)` + 끝 개행).

**갱신 주체와 시점**: 자동화돼 있지 않다. **낡는 것이 기본값이므로 사람이 띄운다.**

| 언제 | 누가 |
|------|------|
| **BE PR 이 공개 API 를 바꾸고 dev 에 배포된 뒤** | 그 PR 작성자 |
| FE 가 새 API 연동을 시작하기 전 | 그 레인 |
| 계약이 의심될 때 (스냅샷에 없는데 서버엔 있는 것 같을 때) | 의심한 사람 |

**dev 배포 전에 받으면 의미가 없다.** 스냅샷은 dev 게이트웨이에서 받으므로, 머지만 하고
배포 전에 받으면 옛 계약이 그대로 온다. 배포 완료를 확인하고 받는다.

**`git diff` 만 보면 어디가 바뀌었는지 안 보인다** — 키 순서와 description 이 함께 흔들려
수백 줄이 잡힌다. 구조로 좁혀서 본다 (operation·schema·필드·타입만):

```bash
python3 - <<'EOF'
import json, subprocess
for svc in ['ai','tour','plan','auth']:
    p = f'docs/api/openapi/{svc}-service.json'
    o = json.loads(subprocess.run(['git','show',f'HEAD:{p}'],capture_output=True,text=True).stdout)
    n = json.load(open(p, encoding='utf-8'))
    ops = lambda d: {f'{m.upper()} {k}' for k, v in d['paths'].items() for m in v
                     if m in ('get','post','put','delete','patch')}
    so, sn = o['components']['schemas'], n['components']['schemas']
    print(f'--- {svc}')
    for label, diff in [('+op', ops(n)-ops(o)), ('-op', ops(o)-ops(n)),
                        ('+schema', set(sn)-set(so)), ('-schema', set(so)-set(sn))]:
        if diff: print(' ', label, sorted(diff))
    for name in sorted(set(so) & set(sn)):
        po, pn = so[name].get('properties',{}) or {}, sn[name].get('properties',{}) or {}
        if set(pn)-set(po): print(f'  ~ {name} + {sorted(set(pn)-set(po))}')
        if set(po)-set(pn): print(f'  ~ {name} - {sorted(set(po)-set(pn))}')
        for f in set(po) & set(pn):
            a = po[f].get('type') or po[f].get('$ref')
            b = pn[f].get('type') or pn[f].get('$ref')
            if a != b: print(f'  ! {name}.{f}: {a} -> {b}')
EOF
```

로컬 백엔드로 받을 때는 호스트만 바꾼다 (`http://localhost:8000`).

**게이트웨이 루트 `/v3/api-docs` 는 비어 있다** (`OpenAPI definition v0`, paths 0). 서비스별
그룹 경로(`/{svc}-service/v3/api-docs`)를 써야 한다 — 목록은 `/v3/api-docs/swagger-config` 가 준다.

## 환경

| 환경  | 게이트웨이                       | Swagger UI                                       |
| ----- | -------------------------------- | ------------------------------------------------ |
| local | `http://localhost:8000`          | `http://localhost:8000/swagger-ui.html`          |
| dev   | `https://api-dev.hondigagae.com` | `https://api-dev.hondigagae.com/swagger-ui.html` |
| prod  | `https://api.hondigagae.com`     | —                                                |

FE 는 이 값을 `BACKEND_API_URL` 로 받는다. 브라우저는 게이트웨이를 직접 부르지 않고
`/api/bff/**` 를 거친다 (`frontend/docs/api-integration-guide.md` §1).

**auth API 는 게이트웨이를 거치지 않는다.** `/api/v1/auth`·`/api/v1/members` 는 nginx 가
auth-service 로 직결시킨다 — 배포에서 사설 IP 대신 공개 도메인을 쓰는 이유다
(`frontend/.env.example` 주석).

## 계약을 읽을 때 걸리는 것들

- **모든 응답이 `{ dataHeader, dataBody }` 로 감싸여 온다.** 게이트웨이가 대신 답하는
  경우(인증 실패 등)에는 래퍼가 없을 수 있다 — 판별 규약은 api-integration-guide §2-1.
- **비동기 AI 작업 실패는 HTTP 200 + `status.code === 'FAILED'`** 다. `dataHeader.success`
  만 보면 놓친다.
- **ID 는 응답에서 문자열로 내려온다** (Snowflake — JS 안전 정수 범위 초과). 스키마의
  `type: integer, format: int64` 는 **요청** 바디 기준이고, 응답 DTO 는 `type: string` 이다.
  FE 는 요청에서도 문자열을 그대로 보낸다.
- **enum 은 `{code, name, description}` metadata 로 온다.** 한국어 매핑 테이블을 FE 에
  만들지 않고 서버가 준 `name`/`description` 을 그대로 렌더한다.
- **`null` 은 "없음"이 아니라 "모름"인 필드가 많다** — `indoor`, `score`,
  `openNow`, `concentrationRate`, `goldenStart` 등. 스키마 description 이 그 뜻을 적어 두었으니
  0·false 로 접지 않는다.
- **`POST /ai-plans` 는 재생성 검증보다 앞서 두 전제를 본다** — 시작일이 오늘 이후
  (`AIPLAN_017`), 기간 10일 이하(`AIPLAN_018`). 스키마에는 안 보이고 서비스 코드에만 있다
  (`AiPlanJobProcessor.submitPlan`). plan-service 는 30일까지 허용하므로 11~30일 일정은
  AI 생성·재생성을 할 수 없다.

## 엔드포인트 인벤토리

`FE 경로` 는 `frontend/src/lib/api/paths.ts` 에 그 경로가 등록돼 있는지다 (화면 연동 여부는
`frontend/docs/screen-inventory.md`). **65 operations 중 52개가 등록돼 있고 13개가 비어 있다.**

### `auth-service` — 회원 및 인증/인가 서비스

| Method   | 경로 (`/api/v1` 하위)                     | 인증 | FE 경로  | 요약                                      |
| -------- | ----------------------------------------- | ---- | -------- | ----------------------------------------- |
| `POST`   | `/auth/email/send-code`                   | 공개 | ✅       | 이메일 인증코드 발송                      |
| `POST`   | `/auth/email/verify-code`                 | 공개 | ✅       | 이메일 인증코드 검증                      |
| `POST`   | `/auth/login`                             | 공개 | ✅       | 일반 로그인                               |
| `POST`   | `/auth/logout`                            | 🔒   | ✅       | 로그아웃                                  |
| `POST`   | `/auth/password/reset`                    | 공개 | ✅       | 비밀번호 재설정                           |
| `POST`   | `/auth/password/reset/send-code`          | 공개 | ✅       | 비밀번호 재설정 코드 발송                 |
| `GET`    | `/auth/sessions`                          | 🔒   | **없음** | 로그인 기기 목록                          |
| `DELETE` | `/auth/sessions/{sessionId}`              | 🔒   | **없음** | 특정 기기 로그아웃                        |
| `POST`   | `/auth/token/reissue`                     | 공개 | ✅       | 토큰 재발급                               |
| `GET`    | `/auth/{provider}/authorize`              | 공개 | ✅       | 소셜 로그인 인가 URL 생성                 |
| `GET`    | `/auth/{provider}/login`                  | 공개 | ✅       | 소셜 로그인                               |
| `GET`    | `/members/me`                             | 🔒   | ✅       | 내 회원 정보 조회                         |
| `PATCH`  | `/members/me`                             | 🔒   | ✅       | 내 회원 정보 수정                         |
| `POST`   | `/members/me/password`                    | 🔒   | ✅       | 비밀번호 변경                             |
| `DELETE` | `/members/me/password`                    | 🔒   | ✅       | 소셜 전용 계정 전환 (비밀번호 제거)       |
| `POST`   | `/members/me/password/setup`              | 🔒   | ✅       | 비밀번호 최초 설정                        |
| `GET`    | `/members/me/pets`                        | 🔒   | ✅       | 내 반려견 목록 조회                       |
| `POST`   | `/members/me/pets`                        | 🔒   | ✅       | 반려견 등록                               |
| `GET`    | `/members/me/pets/{petId}`                | 🔒   | ✅       | 반려견 상세 조회                          |
| `PUT`    | `/members/me/pets/{petId}`                | 🔒   | ✅       | 반려견 정보 수정                          |
| `DELETE` | `/members/me/pets/{petId}`                | 🔒   | ✅       | 반려견 삭제                               |
| `POST`   | `/members/me/pets/{petId}/profile-image`  | 🔒   | ✅       | 반려견 프로필 이미지 업로드               |
| `DELETE` | `/members/me/pets/{petId}/profile-image`  | 🔒   | ✅       | 반려견 프로필 이미지 삭제                 |
| `PUT`    | `/members/me/pets/{petId}/representative` | 🔒   | ✅       | 대표 반려견 지정                          |
| `POST`   | `/members/me/profile-image`               | 🔒   | ✅       | 프로필 이미지 업로드                      |
| `DELETE` | `/members/me/profile-image`               | 🔒   | ✅       | 프로필 이미지 삭제                        |
| `POST`   | `/members/me/withdraw`                    | 🔒   | ✅       | 회원 탈퇴                                 |
| `POST`   | `/members/signup`                         | 공개 | ✅       | 일반 회원가입                             |
| `POST`   | `/members/signup/dev`                     | 공개 | **없음** | [개발용] 즉시 회원가입 (이메일 인증 생략) |

### `tour-service` — 관광 데이터 서비스

| Method | 경로 (`/api/v1` 하위)                  | 인증 | FE 경로  | 요약                 |
| ------ | -------------------------------------- | ---- | -------- | -------------------- |
| `GET`  | `/emergencies/facilities`              | 공개 | ✅       | 주변 긴급 시설 검색  |
| `GET`  | `/emergencies/facilities/{facilityId}` | 공개 | ✅       | 긴급 시설 상세       |
| `GET`  | `/insights/regional-weather`           | 공개 | ✅       | 제주 권역 날씨 비교  |
| `GET`  | `/insights/walk-times`                 | 공개 | ✅       | 오늘의 산책 골든타임 |
| `GET`  | `/places`                              | 공개 | ✅       | 장소 목록 조회       |
| `GET`  | `/places/nearby`                       | 공개 | ✅       | 주변 장소 검색       |
| `GET`  | `/places/{placeId}`                    | 공개 | ✅       | 장소 상세 조회       |
| `GET`  | `/places/{placeId}/congestions`        | 공개 | ✅       | 장소 기간 혼잡도     |
| `GET`  | `/places/{placeId}/suitability`        | 공개 | ✅       | 장소 여행 적합도     |
| `GET`  | `/places/{placeId}/walk-safety`        | 공개 | ✅       | 장소 산책 위험도     |
| `GET`  | `/walk-courses`                        | 공개 | ✅       | 산책 코스 목록       |
| `GET`  | `/walk-courses/{walkCourseId}`         | 공개 | ✅       | 산책 코스 상세       |

### `plan-service` — 여행 일정 서비스

| Method   | 경로 (`/api/v1` 하위)                        | 인증 | FE 경로 | 요약                       |
| -------- | -------------------------------------------- | ---- | ------- | -------------------------- |
| `GET`    | `/favorites/places`                          | 🔒   | ✅      | 내 즐겨찾기 목록           |
| `GET`    | `/favorites/places/{placeId}`                | 🔒   | ✅      | 즐겨찾기 여부 확인         |
| `POST`   | `/favorites/places/{placeId}`                | 🔒   | ✅      | 즐겨찾기 저장              |
| `DELETE` | `/favorites/places/{placeId}`                | 🔒   | ✅      | 즐겨찾기 해제              |
| `GET`    | `/plans`                                     | 🔒   | ✅      | 내 여행 일정 목록 조회     |
| `POST`   | `/plans`                                     | 🔒   | ✅      | 여행 일정 생성             |
| `GET`    | `/plans/{planId}`                            | 🔒   | ✅      | 여행 일정 상세 조회        |
| `PUT`    | `/plans/{planId}`                            | 🔒   | ✅      | 여행 일정 수정             |
| `DELETE` | `/plans/{planId}`                            | 🔒   | ✅      | 여행 일정 삭제             |
| `GET`    | `/plans/{planId}/briefing`                   | 🔒   | ✅       | 여행 브리핑 (하루치)       |
| `PUT`    | `/plans/{planId}/days/{day}/items`           | 🔒   | ✅      | 일자별 일정 항목 일괄 교체 |
| `GET`    | `/plans/{planId}/emergency`                  | 🔒   | ✅      | 일정 응급 브리핑           |
| `PUT`    | `/plans/{planId}/items/{planItemId}/visited` | 🔒   | ✅      | 일정 항목 방문 체크        |
| `GET`    | `/plans/{planId}/packing-items`              | 🔒   | ✅       | 여행 준비물 조회           |
| `PUT`    | `/plans/{planId}/packing-items`              | 🔒   | ✅       | 여행 준비물 저장 (AI 결과 교체) |
| `POST`   | `/plans/{planId}/packing-items`              | 🔒   | ✅       | 여행 준비물 직접 추가      |
| `DELETE` | `/plans/{planId}/packing-items/{packingItemId}` | 🔒 | ✅  | 여행 준비물 삭제           |
| `PUT`    | `/plans/{planId}/packing-items/{packingItemId}/checked` | 🔒 | ✅  | 여행 준비물 챙김 체크 |
| `GET`    | `/plans/{planId}/weather`                    | 🔒   | ✅      | 일정 날씨 브리핑           |
| `POST`   | `/plans/{planId}/copy`                       | 🔒   | ✅      | 일정 복제                  |
| `GET`    | `/plans/{planId}/share-link`                 | 🔒   | ✅      | 공유 링크 조회             |
| `POST`   | `/plans/{planId}/share-link`                 | 🔒   | ✅      | 공유 링크 발급             |
| `DELETE` | `/plans/{planId}/share-link`                 | 🔒   | ✅      | 공유 링크 해제             |
| `GET`    | `/shared-plans/{token}`                      | 공개 | ✅      | 공유된 일정 열람           |
| `GET`    | `/plans/{planId}/reviews`                    | 🔒   | ✅      | 일정 후기 조회             |
| `POST`   | `/plans/{planId}/reviews`                    | 🔒   | ✅      | 일정 후기 작성             |
| `PUT`    | `/plans/{planId}/reviews`                    | 🔒   | ✅      | 일정 후기 수정             |
| `GET`    | `/plans/{planId}/walk-safety`                | 🔒   | ✅      | 일정 항목 산책 위험도      |

> 위 9개는 **#723 재수집에서 스냅샷에 처음 들어왔다.** 서버에는 전부터 있었고 FE 도 이미
> 붙여 둔 것들이다 — 스냅샷만 없었다.

### `ai-service` — AI 서비스

| Method | 경로 (`/api/v1` 하위)             | 인증 | FE 경로 | 요약                               |
| ------ | --------------------------------- | ---- | ------- | ---------------------------------- |
| `POST` | `/ai-plans`                       | 🔒   | ✅      | AI 여행 일정 생성 제출             |
| `GET`  | `/ai-plans/jobs/{jobId}`          | 🔒   | ✅      | AI 여행 일정 생성 작업 조회        |
| `GET`  | `/ai-plans/jobs/{jobId}/stream`   | 🔒   | ✅      | 일정 생성 작업 상태 스트리밍 (SSE) |
| `POST` | `/ai-plans/jobs/{jobId}/cancel`   | 🔒   | ✅      | 일정 생성 작업 취소 (협조적)       |
| `POST` | `/ai-plans/packing-list/{planId}` | 🔒   | ✅      | 반려견 여행 준비물 목록 생성       |

### FE 경로가 없는 3개

미착수 기능이라 호출부를 만들지 않은 것이다 (없는 API 를 상상해 mock 으로 채우지 않는다는
규칙과 같은 판단 — api-integration-guide §9).

| 경로                                                       | 무엇                              | 비고                                                          |
| ---------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------- |
| `GET /auth/sessions` · `DELETE /auth/sessions/{sessionId}` | 로그인 기기 목록 · 개별 로그아웃  | 마이페이지에 기기 관리 화면이 없다                            |
| `POST /members/signup/dev`                                 | 이메일 인증 없이 테스트 계정 생성 | **운영 프로필에는 없다.** dev 연동 테스트 계정을 만들 때 쓴다 |

> **#534 때 "새로 드러난 8개" 는 이제 전부 연동됐다** (#723 에서 `frontend/src` 로 재확인).
> 산책 코스 2(#618 · #735) · 여행 브리핑 1(#626) · 준비물 5 가 `lib/api/paths.ts` 와 화면 양쪽에
> 있다. `GET /places/{placeId}/congestions` 와 `GET /emergencies/facilities/{facilityId}` 도
> 마찬가지다 — 위 표에서 걷었다.
>
> ⚠ **`FE 경로` 열 전체를 다시 감사하지는 않았다.** #723 은 스냅샷 재수집이 목적이라, 이 절과
> 이번에 새로 들어온 9개만 실제 호출부로 확인했다. **다른 행의 `✅` / `없음` 은 오래된 판단일 수
> 있다.** 이 열을 근거로 "FE 가 안 붙였다"를 단정하기 전에 `frontend/src` 를 한 번 보는 편이 낫다.
