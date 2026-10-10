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
 * <p><b>기본값의 근거 (#828).</b> 2026-09-21 첫 재적재 실측으로 적재 총량은 <b>2,099</b> 다
 * (2026-09-18 원천 실측 2,124 에서 적재 대상이 아닌 축제(15) 25건을 뺀 값. 여행코스(25)는 원천에
 * 제주 것이 없어 0 이다 — {@code areaCode=39}·{@code lDongRegnCd=50} 둘 다 totalCount=0).
 *
 * <p><b>값은 "몇 % 어긋나면 신호인가" 에서 끌어냈다.</b> 하한은 실측 대비 20% 감소
 * ({@code floor(2099 * 0.8) = 1679} → 1,680), 상한은 실측의 2배({@code 2099 * 2 = 4198} → 4,200)다.
 *
 * <p><b>왜 20% 인가.</b> 타입 하나가 통째로 빠지는 사고는 0건 WARN 과 delist 타입 스코프가 이미
 * 본다. 이 가드가 잡을 것은 <b>원천이 통째로 어긋나는</b> 쪽이고, 그 선이면 가장 큰 두 타입
 * (음식점 33% · 관광지 27%)이 빠지는 것과 이번 결함의 880건(-58%)을 잡는다. 더 조이지 않는 이유는
 * 원천의 정상 변동 폭을 아직 한 번밖에 재지 못했기 때문이다 — 이 가드가 실패하면 뒤따르는
 * 스텝(이미지·운영시간·delist)까지 멈추므로, 놓치는 비용보다 <b>잘못 멈추는 비용</b>이 크다.
 * 두 번째 실측이 쌓이면 다시 조인다.
 *
 * <p><b>왜 상한을 20,000 에서 내렸나.</b> 20,000 은 실측의 9.5배라 전국 유입(수만 건)만 잡고,
 * 총량이 2~3배로 부푸는 사고(같은 장소가 여러 행으로 들어옴)는 그냥 통과시켰다.
 *
 * <p>이 가드는 <b>총합</b>만 본다. 타입 하나가 통째로 0건인 실행은 delist 범위를 이번에 들어온
 * contentType 으로 좁히는 쪽({@code DelistProcessor.delistPlacesByContentType})이 막는다.
 *
 * @param minRows 전량 실행의 적재 건수 하한. 실측(2,099) 대비 20% 감소선이다 — 이번 결함의
 *                880건은 확실히 걸리고, 원천의 정상적인 증감은 걸리지 않는다. 비거나 0 이하면 1,680
 * @param maxRows 전량 실행의 적재 건수 상한. 실측의 2배선이다 — 전국 유입(수만 건)은 물론 총량이
 *                2~3배로 부푸는 사고도 걸린다. 비거나 0 이하면 4,200
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
            minRows = 1_680;
        }
        if (maxRows == null || maxRows <= 0) {
            maxRows = 4_200;
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
