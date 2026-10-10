package com.hondigagae.domainlayer.plan.domain.enums;

import com.hondigagae.common.dto.metadata.CodeNameDescribable;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 브리핑에 기상특보를 붙이지 못한 이유.
 *
 * <p><b>"못 붙였다" 에는 성질이 다른 둘이 섞여 있다.</b> 정상적으로 낼 수 없는 날
 * ({@link #NOT_TODAY})과 일시 장애({@link #LOOKUP_FAILED})가 갈려야 화면이
 * <b>재시도 버튼을 붙일 수 있다</b>. 뭉뚱그리면 출발 전날 브리핑에 "잠시 후 다시 시도" 가
 * 서고, 사용자는 영원히 채워지지 않을 칸을 새로고침하게 된다.
 *
 * <ul>
 *   <li>{@link #NOT_TODAY} — 특보는 <b>발효 중인 것만 존재</b>하므로 내일 날짜에 오늘 특보를
 *       붙이면 "내일 태풍" 이라는 없는 예보가 화면에 선다. 재시도할 일이 아니다</li>
 *   <li>{@link #LOOKUP_FAILED} — 조회 자체가 실패했다. <b>이것만 장애다</b></li>
 * </ul>
 *
 * <p>{@link PlanDayWeatherUnavailableReason} 과 사유 집합이 다르므로 합치지 않는다 — 특보는
 * 날짜 범위(예보 지평)의 문제가 없고 장소도 필요 없다. 같은 이유로
 * {@link PlanBriefingWalkTimesUnavailableReason} 과도 나눠 둔다.
 *
 * <p>코드는 응답의 {@code weatherWarningUnavailableReasonCode} 로 그대로 나간다. 문장만 내리면
 * 프론트가 사유별로 다르게 그릴 수 없다 (#497, #716). <b>세 상태(특보 있음 / 특보 없음 /
 * 확인 못 함)를 가르는 규칙은 그대로다</b> — 이 코드와 {@code weatherWarning} 이 둘 다 null 일
 * 때만 "발효 중인 특보 없음" 이다.
 */
@Getter
@RequiredArgsConstructor
public enum PlanBriefingWarningUnavailableReason implements CodeNameDescribable {

    NOT_TODAY("당일만 확인",
        "기상특보는 출발 당일에만 확인합니다."),
    LOOKUP_FAILED("조회 실패",
        "기상특보 정보를 가져오지 못했습니다. 기상청 발표를 직접 확인해 주세요.");

    private final String displayName;
    private final String description;
}
