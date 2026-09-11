package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * TourAPI 상세 소개(detailIntro2) 적재 설정.
 *
 * <p><b>쿼터 계산 근거.</b> TourAPI 개발계정은 일 1,000건이고, 이미 도는 추가 이미지
 * 스텝(detailImage2)이 제주 TourAPI 장소 964곳 전량을 매 실행 호출한다. 즉 같은 날 남는
 * 예산은 수십 건 수준이라, intro 스텝이 964곳을 한 번에 돌면 반드시 쿼터를 넘긴다.
 *
 * <p>그래서 <b>실행당 상한</b>을 두고 증분으로 고른다 (기본 300 — 이미지 스텝과 합쳐도
 * 1,264 이므로 운영계정 전환 전에는 두 스텝을 다른 날에 돌리거나 이 값을 낮춘다).
 * 대상은 "intro 행이 없는 곳 먼저 → synced_at 오래된 순"이므로, 주 1회 실행이 반복되며
 * 미적재분을 먼저 덮고 그 뒤에는 갱신 순환이 된다.
 *
 * @param maxCallsPerRun 실행당 detailIntro2 최대 호출 수. 래퍼 타입인 이유는 배포 값이 늘 숫자
 *                       리터럴이 아니기 때문이다 — compose 의 {@code ${VAR:-}} 는 변수를 빈 문자열로
 *                       만들고, 빈 문자열은 바인딩에서 null 로 떨어진다. primitive 면 그 null 이
 *                       record 생성을 깨뜨려 컨테이너가 기동하지 못한다
 *                       ({@code CultureFacilityProperties} 와 같은 함정). 비거나 0 이하면 300
 */
@ConfigurationProperties(prefix = "place-intro-import")
public record PlaceIntroImportProperties(
    Integer maxCallsPerRun
) {

    public PlaceIntroImportProperties {
        if (maxCallsPerRun == null || maxCallsPerRun <= 0) {
            maxCallsPerRun = 300;
        }
    }
}
