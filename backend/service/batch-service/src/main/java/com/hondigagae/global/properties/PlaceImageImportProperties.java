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
 *   17 (목록 areaBasedList2)
 * + 300 (운영시간 detailIntro2 상한)
 * + 400 (이 상한)
 * + 276 (수동 이미지 백필 searchKeyword2 최대)
 * +   1 (올레 코스)
 * = 994 &lt; 1,000
 * </pre>
 *
 * <p>964곳 전량 커버는 3주 순환이다 (⌈964 / 400⌉ = 3, 주 1회 cron). 이미지는 이미 적재돼 있는
 * 데이터의 갱신이라 이 주기로 충분하다. 운영계정 키를 받으면 이 값만 올리면 된다 — 상한이 대상
 * 수보다 크면 순환이 매 실행 전량을 돈다.
 *
 * @param maxCallsPerRun 실행당 detailImage2 최대 호출 수. 래퍼 타입인 이유는 배포 값이 늘 숫자
 *                       리터럴이 아니기 때문이다 — compose 의 {@code ${VAR:-}} 는 변수를 빈 문자열로
 *                       만들고, 빈 문자열은 바인딩에서 null 로 떨어진다. primitive 면 그 null 이
 *                       record 생성을 깨뜨려 컨테이너가 기동하지 못한다
 *                       ({@code CultureFacilityProperties} 와 같은 함정). 비거나 0 이하면 400
 */
@ConfigurationProperties(prefix = "place-image-import")
public record PlaceImageImportProperties(
    Integer maxCallsPerRun
) {

    public PlaceImageImportProperties {
        if (maxCallsPerRun == null || maxCallsPerRun <= 0) {
            maxCallsPerRun = 400;
        }
    }
}
