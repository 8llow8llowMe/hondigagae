package com.hondigagae.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * TourAPI 장소 전량 적재의 건수 가드 (#726).
 *
 * <p><b>왜 필요한가.</b> {@code DelistGuard} 는 직전 활성 건수 대비 <b>상대</b> 비교라
 * "처음부터 적게 받아온" 상태를 잡지 못한다. 실제로 원천이 지역 필터 체계를 바꾸면서 제주
 * 2,124건 중 880건만 들어오던 기간이 있었고, 그 동안 잡은 매번 초록으로 끝났다. 전량 실행의
 * 적재 건수를 절대 범위로 한 번 더 보는 이유가 이것이다.
 *
 * <p><b>하한</b>은 원천 필터가 조용히 어긋나 절반만 들어오는 경우를, <b>상한</b>은 지역 필터가
 * 아예 풀려 전국이 들어오는 경우를 잡는다.
 *
 * <p><b>기본값의 근거.</b> 2026-09-18 실측으로 제주 {@code lDongRegnCd=50} 콘텐츠는 2,124건이고,
 * 그중 축제(15) 25건은 적재 대상이 아니다. 여행코스(25)는 지역 키와 무관하게 0건이다(원천에
 * 제주 여행코스가 없다 — {@code areaCode=39}·{@code lDongRegnCd=50} 둘 다 totalCount=0).
 * 즉 적재 대상 7종의 총량은 {@code 2,124 − 25 = 2,099} 다. 그래도 기본값을 총량에 타이트하게
 * 맞추지 않고 넓게 잡았다 — 이 가드의 목적은 총량을 못박는 것이 아니라 "절반이 조용히 사라짐"과
 * "전국 유입"을 잡는 것이다. 첫 재적재로 실제 건수가 나오면 그때 조인다.
 *
 * <p>이 가드는 <b>총합</b>만 본다. 타입 하나가 통째로 0건인 실행은 delist 범위를 이번에 들어온
 * contentType 으로 좁히는 쪽({@code DelistProcessor.delistPlacesByContentType})이 막는다.
 *
 * @param minRows 전량 실행의 적재 건수 하한. 이번 결함의 880건은 확실히 걸리고, 원천의 정상적인
 *                증감은 걸리지 않는 선으로 잡는다. 비거나 0 이하면 1,200
 * @param maxRows 전량 실행의 적재 건수 상한. 전국 규모(콘텐츠 타입 7종 합산 수만 건)가 확실히
 *                걸리는 선이면 충분하다. 비거나 0 이하면 20,000
 *                <p><b>접기 뒤에 {@code minRows < maxRows} 를 강제한다.</b> 뒤집힌 값은 가드를
 *                항상 실패시켜 전량 실행과 뒤따르는 스텝을 통째로 멈추므로 기동에서 죽인다.
 *                <p>둘 다 래퍼 타입인 이유는 배포 값이 늘 숫자 리터럴이 아니기 때문이다 —
 *                compose 의 {@code ${VAR:-}} 는 변수를 빈 문자열로 만들고, 빈 문자열은
 *                바인딩에서 null 로 떨어진다. primitive 면 그 null 이 record 생성을 깨뜨려
 *                컨테이너가 기동하지 못한다 ({@code CultureFacilityProperties} 와 같은 함정)
 */
@ConfigurationProperties(prefix = "place-import-volume")
public record PlaceImportVolumeProperties(
    Integer minRows,
    Integer maxRows
) {

    public PlaceImportVolumeProperties {
        if (minRows == null || minRows <= 0) {
            minRows = 1_200;
        }
        if (maxRows == null || maxRows <= 0) {
            maxRows = 20_000;
        }
        // 뒤집힌 범위(min >= max)는 접지 않고 기동에서 죽인다. 기본값으로 덮으면 운영자가 준 값이
        // 조용히 무시되고, 그대로 두면 withinRange 가 늘 false 라 전량 실행이 매번
        // IMPORT_VOLUME_OUT_OF_RANGE 로 죽으면서 뒤따르는 스텝까지 멈춘다. 설정 오타는 몇 주 뒤
        // 잡 실패로 발견되는 것보다 기동에서 바로 죽는 편이 원인을 짚기 쉽다.
        if (minRows >= maxRows) {
            throw new IllegalArgumentException(
                "place-import-volume.min-rows must be less than max-rows. minRows=%d, maxRows=%d".formatted(minRows, maxRows));
        }
    }
}
