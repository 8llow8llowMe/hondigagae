# [BE] fix: 반경 검색의 `totalCount` 가 총계가 아니라 `size` 를 따라온다

> 이슈: [#285](https://github.com/8llow8llowMe/hondigagae/issues/285)
> 상태: 구현 완료
> 대상: tour-service `emergency` · `place` 컨텍스트

## 무엇이 문제였나

`GET /api/v1/emergencies/facilities` 의 `totalCount` 가 **총계가 아니라 돌려준 개수**였다.
dev 게이트웨이 실측 — 제주시청(33.4996, 126.5312) · `radius=10000` 으로 `size` 만 바꿔 부른 결과다.

| `size` | `totalCount` | `facilities.length` | 구성              |
| -----: | -----------: | ------------------: | ----------------- |
|      3 |            3 |                   3 | 약국 3            |
|     10 |           10 |                  10 | 약국 8 · 병원 2   |
|     50 |           50 |                  50 | 약국 31 · 병원 19 |

`size=50`(당시 상한)에서 정확히 50건이 왔으므로 그 조회는 이미 잘려 있었고, **응답만으로는
몇 개가 더 있는지 알 수 없었다.**

## 왜 이름만 총계가 됐나

계층이 갈린 자리에서 값이 사라졌다.

```java
// Processor — 자른 목록만 넘긴다. 총계를 담을 자리가 없다
public List<NearbyFacilityInfo> searchNearby(NearbyFacilityQuery query) {
    return ...filter(...).sorted(...).limit(query.size()).toList();
}

// Presenter — 받은 목록을 다시 센다. 이미 잘린 목록이다
.totalCount(items.size())
```

`List<Info>` 로 넘기는 한 Presenter 에게는 셀 것이 잘린 목록뿐이다. **버그는
`items.size()` 한 줄이 아니라 총계를 실어 나를 타입이 없다는 것이었다.**

## 무엇이 걸렸나

FE 는 칩에 개수를 붙인다(`전체 50 · 병원 19 · 약국 31 · 24시간 2`). 잘린 목록에서 센 개수는
전체가 아니므로 잘렸으면 숫자를 빼야 하는데, 판정이 `facilities.length < totalCount` 였다 —
두 값이 언제나 같으니 **늘 거짓**이었고 틀린 개수가 그대로 나갔다.

FE 는 상한 도달(`facilities.length >= MAX_SIZE`)로 판정하도록 우회했다
([#281](https://github.com/8llow8llowMe/hondigagae/issues/281) / PR #283). 우회는 잘림을
알려주지만 "반경 안에 실제로 몇 개인지"는 여전히 말하지 못한다.

## 판단이 갈렸던 지점

이슈는 두 안을 줬다.

1. `totalCount` 를 이름대로 **실제 총계**로 내린다
2. 이름을 `returnedCount` 류로 바꾸고 `hasMore` 같은 **잘림 신호**를 준다

**1번을 골랐다.** 2번은 "총계를 줄 수 없다"는 전제 위에 서 있는데, 이 코드베이스에서는 그
전제가 틀렸다 — 포트(`findWithinBox` · `findNearby`)가 사각 범위 **전량**을 돌려주고 DB 에서
자르지 않으므로, 총계는 이미 메모리에 있고 `.limit()` 이 버리고 있었을 뿐이다. **비용 0 으로
더 많은 정보를 줄 수 있는데 더 적게 주기로 정할 이유가 없다.**

덤으로 1번은 **파괴적 변경이 아니다.** 필드가 늘지도 줄지도 이름이 바뀌지도 않고, FE 의 원래
조건 `facilities.length < totalCount` 가 그대로 정직해진다. 2번은 응답 6곳이 공유하는
`totalCount` 이름 규약과도 어긋난다.

`hasMore` 를 함께 내리는 안도 검토했으나 넣지 않았다 — `totalCount > facilities.length` 로
정확히 유도되는 값이라, 같은 사실을 두 곳에 적으면 언젠가 둘이 어긋난다.

## 어떻게 고쳤나

목록과 총계를 **함께 든 Info** 를 만들어 Processor 가 총계를 세도록 옮겼다.

```java
public record NearbyFacilitiesInfo(List<NearbyFacilityInfo> facilities, int totalCount) {}

// Processor — 자르기 전에 센다
List<NearbyFacilityInfo> matched = ...filter(...).sorted(...).toList();
return new NearbyFacilitiesInfo(matched.stream().limit(query.size()).toList(), matched.size());

// Presenter — 세지 않고 받은 값을 그대로 내린다
.totalCount(info.totalCount())
```

Presenter 가 `NearbyFacilitiesInfo` 를 받으므로 **다시 세는 실수를 타입이 막는다.**

## 함께 고친 것 — `GET /places/nearby`

`NearbyPlaceResponse` 가 **같은 결함을 같은 모양으로** 갖고 있었다(`.limit(criteria.size())`
뒤 `totalCount(items.size())`). 하나만 고치면 다음 사람이 다른 쪽에서 같은 것을 다시
발견하게 되므로 함께 고쳤다 (`NearbyPlacesInfo`).

자를 일이 없는 목록(`FavoritePlacesResponse`, `PetsResponse`, `AuthSessionsResponse`,
`PackingListResponse`)은 `items.size()` 가 곧 총계라 **손대지 않았다.** 판별 기준은
**`size` 파라미터의 유무**이고, 이 기준을 `api-design-guide.md` §5-1 에 규약으로 적었다.

## 곁딸린 사안 — `size` 상한 50 → 250

제주시청 반경 10km 만으로 50이 채워졌다. 화면이 유형·24시간·지금진료중을 **클라이언트에서**
좁히며 칩마다 개수를 보여주는 설계(FE `공통명세.md` E3)라 **한 번에 전량을 받는 것이 전제**인데,
그 전제가 상한에서 깨져 있었다.

제주 전역 시설이 214곳이므로 **250** 으로 올렸다 — `radius=50000`(상한)으로 섬 전체를 훑어도
잘리지 않는다. 부하는 사실상 늘지 않는다: 어차피 사각 범위 전량을 메모리에 올려 거르고 있어
바뀌는 것은 직렬화 개수뿐이다.

`/places/nearby` 의 상한(50)은 **올리지 않았다.** 장소는 수천 건 규모라 같은 논리가 서지 않고,
그쪽 화면은 서버로 좁혀 조회한다.

## 남은 일 (FE)

BE 가 dev 에 올라간 뒤, FE 는 `countsAreComplete` 의 상한 도달 우회를 정직한 조건
(`facilities.length < totalCount`)으로 되돌릴 수 있다. `MAX_SIZE` 도 250 으로 맞추면 제주
전역에서 칩 개수가 항상 정확해진다. **FE 이슈로 따로 올린다** — 배포 순서가 있어 같은 PR 에
담으면 그 사이 화면이 깨진다.

관련 FE 자산:

- `frontend/src/features/emergency/facility-filters.ts` — `countsAreComplete`
- `frontend/src/lib/api/emergency.ts` — `MAX_SIZE`
- `frontend/src/types/emergency.ts` — `NearbyFacilityResult.totalCount` 주석
- `frontend/docs/features/emergency/공통명세.md` — E2-1 · E3
