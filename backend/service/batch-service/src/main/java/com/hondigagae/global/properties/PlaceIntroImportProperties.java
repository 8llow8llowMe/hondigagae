package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * TourAPI 상세 소개(detailIntro2) 적재 설정.
 *
 * <p><b>쿼터 계산 근거.</b> TourAPI 개발계정은 일 1,000건이고, 장소당 1콜인 상세 스텝이
 * 둘이다(운영시간·추가 이미지). 제주 TourAPI 장소가 약 964곳이라 둘 다 전량을 돌면 한 번에
 * 1,900콜이고 반드시 쿼터를 넘긴다.
 *
 * <p>그래서 <b>두 스텝 모두</b> 실행당 상한을 두고 증분으로 고른다 — intro 기본 300, 이미지
 * 기본 400 ({@link PlaceImageImportProperties}, #478). 같은 날 최악 합이
 * {@code 17 + 300 + 400 + 276 + 1 = 994} 라 예산 안에 든다. 대상은 "intro 행이 없는 곳 먼저 →
 * synced_at 오래된 순"이므로, 주 1회 실행이 반복되며 미적재분을 먼저 덮고 그 뒤에는 갱신 순환이 된다.
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
