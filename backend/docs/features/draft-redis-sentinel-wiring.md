# [BE] feat: Redis Sentinel 접속 배선과 설정 누락 기동 실패

> GitHub 이슈 초안. 아래 `## 어떤 기능인가요?` 부터가 이슈 본문이다.
>
> - 라벨: `backend-core`, `backend-auth-service`, `backend-ai-service`, `backend-tour-service`, `backend-api-gateway`
> - 브랜치: `feature/be/<이슈번호>-redis-sentinel-wiring`
> - 예상 규모: 12파일
>
> **사후 초안이다.** 구현이 먼저 들어갔고(`2dbfcb6`) 이 문서는 PR 의 `Issue Number` 를
> 채우기 위해 뒤늦게 쓴다. 원래 순서(이슈 → 브랜치 → 작업)와 반대라는 점을 남겨 둔다.

---

## 어떤 기능인가요? ✏

- dev/prod 를 **Redis Sentinel 3노드**로 띄울 수 있게 접속 설정을 실제로 배선한다
- 지금은 `REDIS_MODE=sentinel` 로 두면 **기동 시점에 NPE 로 죽는다.** 어느 yml 도
  `master-name` 과 노드 목록을 넣어 주지 않는데 `RedisConfigurer` 가
  `sentinels().forEach()` 를 그냥 부르기 때문이다. 스택트레이스만 보면 원인이 설정 누락이라는
  것이 드러나지 않는다
- 즉 sentinel 분기는 지금까지 **한 번도 실행된 적 없는 스캐폴딩**이다

## 작업 상세 내용 📝

- [ ] `RedisProperties` 에 `sentinel-nodes` 문자열 추가 — `host:port,host:port,host:port`
- [ ] 형식이 깨진 노드 항목은 조용히 버리지 않고 예외로 올린다
- [ ] `RedisConfigurer` 에 fail-fast 검증 — `master-name`/노드 목록이 비면 어떤 env 를 넣어야
      하는지 적힌 `IllegalStateException`
- [ ] dev/prod yml 8개(ai·auth·tour × dev/prod, api-gateway × dev/prod) 배선
- [ ] `.env.example` 에 `REDIS_MASTER_NAME`, `REDIS_SENTINEL_NODES` 추가 + `REDIS_MODE=sentinel`
- [ ] `docs/modules.md` 의 redis-core 절 갱신

## 참고할만한 자료(선택)

### 왜 목록형이 아니라 문자열 하나인가

Spring 의 목록형 프로퍼티(`infra.redis.sentinels[0].host`)를 환경변수로 넘기려면 인덱스별
키를 나열해야 한다(`INFRA_REDIS_SENTINELS_0_HOST`). Vault·compose 에서 다루기 번거롭고,
**노드 수가 바뀔 때 빠뜨리기 쉽다.** 문자열 하나면 노드 수와 무관하게 한 값만 관리한다.

yml 목록도 계속 받되 로컬에서 손으로 적을 때의 탈출구로만 둔다. 문자열이 있으면 그쪽이 이긴다.

### 왜 깨진 항목을 조용히 버리지 않는가

Sentinel 노드 하나가 조용히 빠져도 **평소에는 잘 돈다.** 문제는 페일오버 때만 드러나는데,
그때는 이미 장애 상황이라 원인을 찾을 여유가 없다. 기동 시점에 죽는 편이 낫다.

### BossPickSeoul 은 참고 대상이 아니다

같은 `redis-core` 를 공유하는 BossPickSeoul(NowDoBoss-V2)에도 **Sentinel 배선이 없다.**
`RedisConfigurer` 가 이 저장소의 수정 전 버전과 동일하고, yml 8개 전부 `master-name`·
`sentinels` 없이 `mode/host/port/password/key-prefix` 만 넣으며, `.env.example` 은
`REDIS_MODE=standalone` 이다. 인프라에는 `redis-node1/sentinel-node1`(192.168.0.11),
`redis-node2/redis-sentinel-node2`(192.168.0.13)가 있지만 **앱은 standalone 으로만 붙는다.**

그쪽도 sentinel 로 전환하려면 같은 수정이 필요하다.

### 의도적으로 다르게 둔 곳

dev/prod yml 은 `${REDIS_MODE}` 처럼 기본값 없이 env 를 요구하는 것이 이 저장소의 패턴이다.
다만 `master-name`/`sentinel-nodes` 는 `${...:}` 빈 기본값으로 두었다 — standalone 배포에서는
필요 없는 값이라서다. 대신 sentinel 모드일 때만 위의 fail-fast 가 잡는다. Spring 의
플레이스홀더 미해결 에러보다 "어떤 env 를 넣어라"가 적힌 예외가 읽기 쉽다.
