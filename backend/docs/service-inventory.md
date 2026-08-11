# Backend Service Inventory

> 상태: 전 서비스 **기획 단계** (구현 착수 전). 서비스 착수 시 이 문서와 `services/*.md`를 함께 갱신한다.

## Auth Service

- 책임: 회원 인증(카카오 소셜 로그인), 토큰 발급/재발급/로그아웃, 회원 기본 정보, 반려견 프로필 관리
- 컨텍스트: `auth`, `member`, `pet`
- 특징: `AuthSecurityConfigurer` 기반 인증/인가 서비스. 반려견 프로필(품종, 나이, 더위/추위 민감도, 활동 성향)은 AI 추천의 핵심 입력이므로 이 서비스가 단일 원천이다.
- 상태: 기획

## Tour Service

- 책임: 장소(관광지/음식점/숙박/카페) 검색·상세, 반려견 동반 조건, 연관 관광지, 두루누비 산책 코스, 여행 적합도 분석(날씨+혼잡도), 24시 동물병원 조회
- 컨텍스트: `place`, `walkcourse`, `insight`, `emergency`
- 특징: 조회 중심 서비스, Presenter/Info 구조 사용. batch-service가 적재한 데이터를 DB에서 조회하고, 날씨·혼잡도만 캐시를 앞에 둔 실시간 계열로 처리한다.
- 상태: 기획

## Plan Service

- 책임: 여행 일정 CRUD, 일정 항목 편집, 여행 후기, 일정 공유(향후 카카오 메시지 연계)
- 컨텍스트: `plan`, `review`
- 특징: write 중심 서비스, 도메인 중심 write 흐름 사용. AI가 생성한 일정도 최종 저장은 이 서비스가 담당한다 (ai-service는 일정을 소유하지 않는다).
- 상태: 기획

## AI Service

- 책임: AI 기능 후보(여행 플래너, 일정 수정, 상담사/비서, 적합도 해설, 성향 분석, 후기 자동 작성, XAI 등) 중 **의사결정으로 선정된 기능**의 LLM 기반 구현. 후보 풀과 선정 기준은 루트 `README.md` 참고
- 컨텍스트: `planner`, `assistant`, `analysis`
- 특징: LLM 어댑터 분기 가능 구조(`AiLlmPort`), Redis 기반 작업 상태/결과 캐시, 비동기 제출 + 폴링/SSE 조회 (`POST` 제출 + `GET /jobs/{id}`, `GET /jobs/{id}/stream`), tour-service·plan-service Feign 조회
- 상태: 기획

## Batch Service

- 책임: TourAPI/반려동물 동반여행/연관 관광지/두루누비/혼잡도 데이터 수집·대량 적재
- 특징: Spring Batch 기반, 실행 파라미터 중심 운영, 재실행 가능(idempotent) 적재. 세부 기준은 `external-api-guide.md` §5
- 상태: 기획
