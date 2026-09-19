package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.PlanBriefingResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo.ItemBriefInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo.ScheduleInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanBriefingInfo.WalkTimesInfo;
import com.hondigagae.domainlayer.plan.domain.enums.PlanBriefingWalkTimesUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.enums.PlanBriefingWarningUnavailableReason;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * 브리핑 응답의 웹 계약을 고정한다 (#716).
 *
 * <p>고정하는 것은 셋이다.
 * <ul>
 *   <li><b>대표 좌표는 골든타임과 무관하게 나간다</b> — {@code walkTimes} 가 null 인 날에도
 *       {@code schedule.representativeLat/Lng} 가 채워져야 화면이 지도와 시간대별 곡선 조회를
 *       부를 수 있다. 이 건의 핵심이다
 *   <li><b>사유는 코드와 문장 둘 다로 나간다</b> — 문장만 내리면 프론트가 사유별로 다르게 그릴 수
 *       없어 문장을 파싱하게 되고, 코드만 내리면 같은 사실을 서버와 화면이 각자의 문구로 말한다 (#497)
 *   <li><b>{@code itemType} 은 일정 상세와 같은 metadata</b> — 두 화면이 같은 값을 다른 모양으로
 *       받으면 프론트가 한국어 매핑 테이블을 따로 만들게 된다
 * </ul>
 */
class PlanBriefingPresenterTest {

    private static final LocalDate DATE = LocalDate.of(2026, 9, 13);
    private static final double LAT = 33.394162;
    private static final double LNG = 126.239831;

    private final PlanBriefingPresenter presenter = new PlanBriefingPresenter(new PlanWeatherPresenter());

    /** 대표 장소 좌표를 아는 하루. 날씨는 null 로 둔다 — 여기서 검증할 것이 아니다. */
    private static PlanBriefingInfo.PlanBriefingInfoBuilder briefing() {
        return PlanBriefingInfo.builder()
            .planId(900L)
            .planTitle("몽실이와 제주 1박 2일")
            .day(2)
            .date(DATE)
            .today(false)
            .petIds(List.of(2L))
            .basisPetId(2L)
            .petConditionApplied(true)
            .schedule(schedule(LAT, LNG));
    }

    private static ScheduleInfo schedule(Double lat, Double lng) {
        return ScheduleInfo.builder()
            .itemCount(2)
            .visitedCount(0)
            .firstItem(ItemBriefInfo.builder()
                .planItemId(11L).sequence(0).itemType(PlanItemType.PLACE)
                .title("협재해수욕장").startTime(LocalTime.of(10, 0)).visited(false)
                .build())
            .lastItem(ItemBriefInfo.builder()
                .planItemId(12L).sequence(1).itemType(PlanItemType.MOVE)
                .title("공항 이동").visited(false)
                .build())
            .representativePlaceId(100L)
            .representativePlaceTitle("협재해수욕장")
            .representativeLat(lat)
            .representativeLng(lng)
            .build();
    }

    private static WalkTimesInfo walkTimes() {
        return WalkTimesInfo.builder()
            .from(LocalDateTime.of(DATE, LocalTime.of(13, 0)))
            .forecastCoverageCode("AVAILABLE").forecastCoverageName("예보 있음")
            .goldenStart(LocalDateTime.of(DATE, LocalTime.of(18, 0)))
            .goldenEnd(LocalDateTime.of(DATE, LocalTime.of(21, 0)))
            .goldenLevelCode("SAFE").goldenLevelName("안전")
            .goldenWindowStatusCode("AVAILABLE").goldenWindowStatusName("추천 구간 있음")
            .petConditionApplied(true)
            .build();
    }

    @Test
    @DisplayName("골든타임이 null 인 날에도 대표 좌표는 나간다 — 화면이 지도와 곡선 조회를 부를 수 있어야 한다")
    void scheduleCarriesPointEvenWhenWalkTimesIsNull() {
        PlanBriefingResponse response = presenter.toResponse(briefing()
            .walkTimes(null)
            .walkTimesUnavailableReason(PlanBriefingWalkTimesUnavailableReason.NOT_TODAY)
            .build());

        assertThat(response.walkTimes()).isNull();
        assertThat(response.schedule().representativeLat()).isEqualTo(LAT);
        assertThat(response.schedule().representativeLng()).isEqualTo(LNG);
        // 대표 장소 세 값이 한 자리에 모인다
        assertThat(response.schedule().representativePlaceId()).isEqualTo("100");
        assertThat(response.schedule().representativePlaceTitle()).isEqualTo("협재해수욕장");
    }

    @Test
    @DisplayName("좌표를 모르는 날은 null 이다 — 0.0 으로 접으면 적도상의 한 점이 된다")
    void unknownPointStaysNull() {
        PlanBriefingResponse response = presenter.toResponse(briefing()
            .schedule(schedule(null, null))
            .walkTimes(null)
            .walkTimesUnavailableReason(PlanBriefingWalkTimesUnavailableReason.NO_PLACE_POINT)
            .build());

        assertThat(response.schedule().representativeLat()).isNull();
        assertThat(response.schedule().representativeLng()).isNull();
        assertThat(response.walkTimesUnavailableReasonCode()).isEqualTo("NO_PLACE_POINT");
    }

    @Test
    @DisplayName("골든타임이 있는 날은 두 자리의 좌표가 같은 값이다 — 중복이지만 의도된 것이다")
    void walkTimesPointMatchesSchedulePoint() {
        PlanBriefingResponse response = presenter.toResponse(briefing()
            .walkTimes(walkTimes())
            .build());

        assertThat(response.walkTimes().lat()).isEqualTo(response.schedule().representativeLat());
        assertThat(response.walkTimes().lng()).isEqualTo(response.schedule().representativeLng());
    }

    @Test
    @DisplayName("itemType 은 일정 상세와 같은 {code,name,description} 으로 나간다 — code 는 enum 이름이다")
    void itemTypeCarriesMetadata() {
        PlanBriefingResponse response = presenter.toResponse(briefing().build());

        assertThat(response.schedule().firstItem().itemType().code()).isEqualTo(PlanItemType.PLACE.name());
        assertThat(response.schedule().firstItem().itemType().name()).isEqualTo(PlanItemType.PLACE.getDisplayName());
        assertThat(response.schedule().firstItem().itemType().description())
            .isEqualTo(PlanItemType.PLACE.getDescription());
        assertThat(response.schedule().lastItem().itemType().code()).isEqualTo("MOVE");
    }

    @ParameterizedTest
    @EnumSource(PlanBriefingWarningUnavailableReason.class)
    @DisplayName("특보 사유가 있으면 코드와 문장이 짝으로 나간다 — 문장의 출처는 enum 하나다")
    void warningReasonCarriesBothCodeAndSentence(PlanBriefingWarningUnavailableReason reason) {
        PlanBriefingResponse response = presenter.toResponse(briefing()
            .weatherWarningUnavailableReason(reason)
            .build());

        assertThat(response.weatherWarningUnavailableReasonCode()).isEqualTo(reason.name());
        assertThat(response.weatherWarningUnavailableReason()).isEqualTo(reason.getDescription());
        // 코드가 채워진 날은 "발효 중인 특보 없음" 이 아니다
        assertThat(response.weatherWarning()).isNull();
    }

    @ParameterizedTest
    @EnumSource(PlanBriefingWalkTimesUnavailableReason.class)
    @DisplayName("골든타임 사유가 있으면 코드와 문장이 짝으로 나간다 — 문장의 출처는 enum 하나다")
    void walkTimesReasonCarriesBothCodeAndSentence(PlanBriefingWalkTimesUnavailableReason reason) {
        PlanBriefingResponse response = presenter.toResponse(briefing()
            .walkTimesUnavailableReason(reason)
            .build());

        assertThat(response.walkTimesUnavailableReasonCode()).isEqualTo(reason.name());
        assertThat(response.walkTimesUnavailableReason()).isEqualTo(reason.getDescription());
    }

    @Test
    @DisplayName("사유가 없으면 코드도 문장도 null 이다 — 특보는 둘 다 null 일 때만 '발효 중인 특보 없음' 이다")
    void noReasonLeavesCodeAndSentenceNull() {
        PlanBriefingResponse response = presenter.toResponse(briefing()
            .walkTimes(walkTimes())
            .build());

        assertThat(response.weatherWarningUnavailableReasonCode()).isNull();
        assertThat(response.weatherWarningUnavailableReason()).isNull();
        assertThat(response.walkTimesUnavailableReasonCode()).isNull();
        assertThat(response.walkTimesUnavailableReason()).isNull();
    }

    /**
     * 사유 문장은 <b>화면이 그대로 출력하는 사용자 문구</b>다. 위 두 {@code @EnumSource} 테스트는
     * "코드와 문장이 짝으로 나간다" 만 고정할 뿐 문장 자체는 고정하지 않아, enum 만 고치면 문구가
     * 소리 없이 바뀐다. 특히 {@code LOOKUP_FAILED} 둘은 사용자에게 <b>재시도를 약속하는</b> 문장이라
     * 사유 성격이 바뀌지 않았는데 문구만 흔들리면 안 된다 (#716 에서 Processor 상수에서 옮겨 왔다).
     */
    @Test
    @DisplayName("사유 문장은 리터럴로 고정한다 — enum 만 고쳐 화면 문구가 조용히 바뀌지 않게 한다")
    void reasonSentencesStayPinned() {
        assertThat(PlanBriefingWarningUnavailableReason.NOT_TODAY.getDescription())
            .isEqualTo("기상특보는 출발 당일에만 확인합니다.");
        assertThat(PlanBriefingWarningUnavailableReason.LOOKUP_FAILED.getDescription())
            .isEqualTo("기상특보 정보를 가져오지 못했습니다. 기상청 발표를 직접 확인해 주세요.");

        assertThat(PlanBriefingWalkTimesUnavailableReason.NOT_TODAY.getDescription())
            .isEqualTo("산책 골든타임은 출발 당일에만 제공됩니다.");
        assertThat(PlanBriefingWalkTimesUnavailableReason.NO_PLACE_ITEM.getDescription())
            .isEqualTo("이 날짜에는 장소가 지정된 일정 항목이 없어 골든타임을 붙이지 못했습니다.");
        assertThat(PlanBriefingWalkTimesUnavailableReason.NO_PLACE_POINT.getDescription())
            .isEqualTo("대표 장소의 좌표가 없어 골든타임을 붙이지 못했습니다.");
        assertThat(PlanBriefingWalkTimesUnavailableReason.LOOKUP_FAILED.getDescription())
            .isEqualTo("산책 골든타임 정보를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
}
