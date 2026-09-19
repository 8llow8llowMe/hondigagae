package com.hondigagae.domainlayer.plan.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 브리핑에 산책 골든타임을 붙이지 못한 이유.
 *
 * <p><b>"못 붙였다" 에는 성질이 다른 넷이 섞여 있다.</b> 정상적으로 낼 수 없는 날
 * ({@link #NOT_TODAY} · {@link #NO_PLACE_ITEM} · {@link #NO_PLACE_POINT})과 일시 장애
 * ({@link #LOOKUP_FAILED})가 갈려야 화면이 <b>재시도 버튼을 붙일 수 있다</b>. 뭉뚱그리면
 * 장소를 담지 않은 날에 "잠시 후 다시 시도" 가 서고, 정작 사용자가 할 일(장소 담기)은 화면
 * 어디에도 드러나지 않는다.
 *
 * <ul>
 *   <li>{@link #NOT_TODAY} — tour 의 {@code GET /api/v1/insights/walk-times} 가 "오늘 남은 시간"
 *       전용이라 내일 이후를 물을 수단 자체가 없다. 재시도해도 생기지 않는다</li>
 *   <li>{@link #NO_PLACE_ITEM} — 그날 일정에 장소성 항목이 없다. 골든타임의 문제가 아니라
 *       일정의 문제라 사용자가 장소를 담으면 풀린다</li>
 *   <li>{@link #NO_PLACE_POINT} — 대표 장소는 있는데 원천이 좌표를 주지 않거나 delisted 다.
 *       다른 장소를 담으면 풀린다</li>
 *   <li>{@link #LOOKUP_FAILED} — 조회 자체가 실패했다. <b>넷 중 이것만 장애다</b></li>
 * </ul>
 *
 * <p>{@link PlanBriefingWarningUnavailableReason} 과 겹치는 값({@code NOT_TODAY} ·
 * {@code LOOKUP_FAILED})이 있어도 합치지 않는다. 사유 집합이 다르고(특보는 좌표를 쓰지 않는다),
 * 합치면 특보 쪽 허용값에 있을 수 없는 {@code NO_PLACE_POINT} 가 섞여 Swagger 의
 * {@code allowableValues} 가 거짓말을 한다. {@link PlanDayWeatherUnavailableReason} 과
 * {@code PlanItemWalkSafetyUnavailableReason} 을 겹침에도 따로 둔 것과 같은 판단이다.
 *
 * <p>코드는 응답의 {@code walkTimesUnavailableReasonCode} 로 그대로 나간다. 문장만 내리면
 * 프론트가 사유별로 다르게 그릴 수 없다 (#497, #716).
 */
@Getter
@RequiredArgsConstructor
public enum PlanBriefingWalkTimesUnavailableReason implements CodeNameDescribable {

    NOT_TODAY("당일만 제공",
        "산책 골든타임은 출발 당일에만 제공됩니다."),
    NO_PLACE_ITEM("장소 미지정",
        "이 날짜에는 장소가 지정된 일정 항목이 없어 골든타임을 붙이지 못했습니다."),
    NO_PLACE_POINT("좌표 없음",
        "대표 장소의 좌표가 없어 골든타임을 붙이지 못했습니다."),
    LOOKUP_FAILED("조회 실패",
        "산책 골든타임 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.");

    private final String displayName;
    private final String description;
}
