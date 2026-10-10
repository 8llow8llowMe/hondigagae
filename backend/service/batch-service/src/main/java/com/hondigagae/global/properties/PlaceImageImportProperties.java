package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * TourAPI 추가 이미지(detailImage2) 적재 설정 (#478).
 *
 * <p><b>쿼터 계산 근거.</b> TourAPI 개발계정은 일 1,000건이다. 이 스텝은 예전에 제주 TourAPI
 * 장소 964곳 <b>전량</b>을 매 실행 불렀고, 운영시간 스텝(#361)이 먼저 300 을 쓰는 순서가 되면서
 * 매 실행 약 280곳의 갱신이 그냥 빠졌다. 어느 280곳인지도 정해져 있지 않았다 — 대상 쿼리에
 * 정렬이 없어 MySQL 이 돌려주는 순서가 곧 우선순위였다.
 *
 * <p>그래서 <b>실행당 상한</b>을 두고 "한 번도 부르지 않은 곳 먼저 → {@code place.image_synced_at}
 * 오래된 순 → id" 로 고른다. 같은 날 최악 합이 기준이다.
 *
 * <pre>
 *   24 (목록 areaBasedList2)
 * + 300 (운영시간 detailIntro2 상한)
 * + 380 (이 상한)
 * + 276 (수동 이미지 백필 searchKeyword2 최대)
 * +   1 (올레 코스)
 * = 981 &lt; 1,000
 * </pre>
 *
 * <p><b>400 → 380 으로 내렸다 (#726).</b> 지역 필터를 {@code lDongRegnCd} 로 고치면서 대상 풀이
 * 약 964곳 → 약 2,100곳이 됐고 목록 콜도 17 → 약 24 로 늘었다(2026-09-18 실측 2,099건 ÷
 * {@code PAGE_SIZE=100} = 23콜 + 여행코스(25)는 0건이라 페이지 1회만). 400 을 그대로 두면 합이
 * {@code 24 + 300 + 400 + 276 + 1 = 1,001} 로 일 한도를 넘긴다. 줄이는 쪽으로 이미지를 고른 것은
 * 저장소가 이미 정한 우선순위다 — 상세 소개가 이미지보다 먼저고, 모자란 날에는 앞이 이긴다
 * ({@code PlaceImportJobConfig}). 이미지는 이미 적재된 데이터의 갱신이고 intro 는 아직 없는 데이터다.
 *
 * <p>전량 커버는 3주 → <b>약 6주</b> 순환이 됐다 (⌈2,100 / 380⌉ = 6, 주 1회 cron). 이미지는 이미
 * 적재돼 있는 데이터의 갱신이라 이 주기로도 견딘다. 운영계정 키를 받으면 이 값만 올리면 된다 —
 * 상한이 대상 수보다 크면 순환이 매 실행 전량을 돈다.
 *
 * <p>목록 콜은 원천 건수가 늘면 같이 는다(타입마다 {@code ceil(totalCount / 100)} 콜). 첫 재적재
 * 실측 후 이 계산식을 다시 조인다.
 *
 * @param maxCallsPerRun 실행당 detailImage2 최대 호출 수. 래퍼 타입인 이유는 배포 값이 늘 숫자
 *                       리터럴이 아니기 때문이다 — compose 의 {@code ${VAR:-}} 는 변수를 빈 문자열로
 *                       만들고, 빈 문자열은 바인딩에서 null 로 떨어진다. primitive 면 그 null 이
 *                       record 생성을 깨뜨려 컨테이너가 기동하지 못한다
 *                       ({@code CultureFacilityProperties} 와 같은 함정). 비거나 0 이하면 380
 */
@ConfigurationProperties(prefix = "place-image-import")
public record PlaceImageImportProperties(
    Integer maxCallsPerRun
) {

    public PlaceImageImportProperties {
        if (maxCallsPerRun == null || maxCallsPerRun <= 0) {
            maxCallsPerRun = 380;
        }
    }
}
