package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.hondigagae.common.dto.metadata.CodeNameDescriptionMetadata;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanItemPlaceItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.PlanItemWalkCourseItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.SharedPlanItemItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.SharedPlanResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemPlaceInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemWalkCourseInfo;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 공유 응답이 <b>무엇을 감추는가</b> 를 고정한다 (이슈 #627).
 *
 * <p>이 이슈의 핵심은 "일정을 보여 준다" 가 아니라 "이것들은 보여 주지 않는다" 다. 감춤은 코드를
 * 읽어서는 증명되지 않는다 — 필드를 하나 더하는 순간 조용히 새기 때문이다. 그래서 두 가지를 건다.
 *
 * <ul>
 *   <li><b>직렬화 결과에 금지 키가 없다</b> — 값이 채워진 {@link PlanInfo} 를 변환해 실제 JSON 을 본다
 *   <li><b>record component 이름 집합을 정확히 고정한다</b> — 나중에 필드를 더하면 이 테스트가
 *       깨져서 "이 값을 남에게 보여도 되는가" 를 다시 묻게 된다
 * </ul>
 */
class PlanShareLinkPresenterTest {

    /** 주인만 쓰는 값. 공유 응답 어디에도 이 키가 있으면 안 된다. */
    private static final List<String> FORBIDDEN_KEYS =
        List.of("planId", "petId", "petIds", "budget", "planItemId", "memo", "visited");

    private final PlanShareLinkPresenter presenter = new PlanShareLinkPresenter();
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    @DisplayName("예산·메모·반려견·방문 체크가 채워진 일정을 변환해도 그 키는 JSON 에 없다")
    void hidesOwnerOnlyFields() throws Exception {
        String json = objectMapper.writeValueAsString(presenter.toSharedPlanResponse(filledPlanInfo()));

        assertThat(json).doesNotContain(FORBIDDEN_KEYS);
    }

    /**
     * 위 검사는 산책 항목이 없는 픽스처만 본다. 코스 요약은 <b>중첩 서브트리</b>라 거기에 금지 키가
     * 섞여도 위 테스트는 초록이다 — 그물을 그 아래까지 내린다.
     */
    @Test
    @DisplayName("산책 코스 요약 서브트리에도 주인 전용 키가 없다 — 감춤 검사가 중첩 아래에서 끊기지 않는다")
    void hidesOwnerOnlyFieldsInsideWalkCourseSummary() throws Exception {
        String json = objectMapper.writeValueAsString(presenter.toSharedPlanResponse(walkPlanInfo()));

        assertThat(json).contains("시흥-광치기");
        assertThat(json).doesNotContain(FORBIDDEN_KEYS);
    }

    @Test
    @DisplayName("보여 주는 값은 그대로 실린다 — 감추기가 과해 일정이 빈 채로 나가면 공유가 쓸모없다")
    void keepsTheSharedFields() {
        SharedPlanResponse response = presenter.toSharedPlanResponse(filledPlanInfo());

        assertThat(response.title()).isEqualTo("몽실이와 제주 2박 3일");
        assertThat(response.areaCode()).isEqualTo("39");
        assertThat(response.sigunguCode()).isEqualTo("4");
        assertThat(response.totalDays()).isEqualTo(3);
        assertThat(response.status().code()).isEqualTo(PlanStatus.CONFIRMED.name());
        assertThat(response.items()).hasSize(2);

        SharedPlanItemItem first = response.items().getFirst();
        assertThat(first.title()).isEqualTo("천지연폭포");
        assertThat(first.itemType().code()).isEqualTo(PlanItemType.PLACE.name());
        assertThat(first.targetId()).isEqualTo("212481712381923328");
        assertThat(first.startTime()).isEqualTo(LocalTime.of(10, 30));
        assertThat(first.place().addr1()).isEqualTo("제주특별자치도 서귀포시 천지동");

        // 장소를 가리키지 않는 항목(MOVE)은 targetId·place 가 null 이고, 항목 자체는 남는다.
        SharedPlanItemItem second = response.items().get(1);
        assertThat(second.targetId()).isNull();
        assertThat(second.place()).isNull();
    }

    @Test
    @DisplayName("SharedPlanResponse 의 필드 집합은 정확히 여덟이다 — 늘리려면 이 테스트를 먼저 고쳐야 한다")
    void sharedPlanResponseComponentsArePinned() {
        assertThat(componentNamesOf(SharedPlanResponse.class)).containsExactlyInAnyOrder(
            "title", "areaCode", "sigunguCode", "startDate", "endDate", "totalDays", "status", "items");
    }

    @Test
    @DisplayName("SharedPlanItemItem 의 필드 집합은 정확히 여덟이다 — planItemId·memo·visited 가 없다")
    void sharedPlanItemComponentsArePinned() {
        assertThat(componentNamesOf(SharedPlanItemItem.class)).containsExactlyInAnyOrder(
            "day", "sequence", "itemType", "targetId", "title", "startTime", "place", "walkCourse");
    }

    /**
     * 위 고정은 <b>최상위 이름만</b> 본다. 중첩 DTO 는 소유자 상세와 <b>공유하는</b> 타입이라,
     * 소유자 화면을 위해 거기에 필드를 하나 더하면 {@code from} 이 채우는 순간 토큰만 아는
     * 제3자에게 그대로 나간다. 그 연결에 그물을 친다 — 깨지면 "남에게 보여도 되는가" 를 다시 묻는다.
     */
    @Test
    @DisplayName("공유 응답이 품는 중첩 DTO 의 필드 집합도 고정한다 — 상세에 필드를 더하면 공개 응답이 따라 넓어진다")
    void nestedSharedItemComponentsArePinned() {
        assertThat(componentNamesOf(PlanItemWalkCourseItem.class)).containsExactlyInAnyOrder(
            "name", "courseLabel", "distanceKm", "durationText", "durationMaxMinutes",
            "lat", "lng", "firstImage", "fitsActivityLevels");
        assertThat(componentNamesOf(PlanItemPlaceItem.class)).containsExactlyInAnyOrder(
            "addr1", "indoor", "firstImage", "lat", "lng");
    }

    private static Set<String> componentNamesOf(Class<?> recordType) {
        return Arrays.stream(recordType.getRecordComponents())
            .map(RecordComponent::getName)
            .collect(Collectors.toUnmodifiableSet());
    }

    @Test
    @DisplayName("산책 항목은 공유 응답에도 코스 요약을 싣는다 — 주인이 보는 화면과 같은 값이어야 한다")
    void sharedWalkItemCarriesTheCourseSummary() {
        SharedPlanItemItem shared = presenter.toSharedPlanResponse(walkPlanInfo()).items().getFirst();

        assertThat(shared.walkCourse()).isNotNull();
        assertThat(shared.walkCourse().name()).isEqualTo("시흥-광치기");
        assertThat(shared.walkCourse().courseLabel()).isEqualTo("1코스");
        assertThat(shared.walkCourse().durationMaxMinutes()).isEqualTo(300);
        assertThat(shared.walkCourse().fitsActivityLevels()).extracting(CodeNameDescriptionMetadata::code)
            .containsExactly("MEDIUM");
    }

    /**
     * #719 가 고친 증상을 그대로 겨눈다. <b>두 Presenter 의 실제 출력</b>을 대조한다 — 공유 쪽이
     * 부르는 팩토리와 비교하면 동어반복이라, 누가 {@link PlanPresenter} 에 사본을 되살려 값이
     * 갈라져도 잡지 못한다.
     */
    @Test
    @DisplayName("공유의 코스 요약은 소유자 상세와 같은 값이다 — 같은 항목을 두 화면이 다르게 설명하지 않는다")
    void sharedCourseSummaryEqualsTheOwnerDetail() {
        PlanInfo info = walkPlanInfo();

        assertThat(presenter.toSharedPlanResponse(info).items().getFirst().walkCourse())
            .isEqualTo(new PlanPresenter().toDetailResponse(info).items().getFirst().walkCourse());
    }

    @Test
    @DisplayName("코스 요약이 없으면 객체 통째로 null 이다 — 코스 없음과 조회 실패를 가르지 않는다")
    void sharedItemWithoutCourseSummaryIsNull() {
        SharedPlanResponse response = presenter.toSharedPlanResponse(filledPlanInfo());

        assertThat(response.items()).extracting(SharedPlanItemItem::walkCourse).containsOnlyNulls();
    }

    /** 산책 항목 하나짜리 일정. 코스 요약이 붙는 경로만 보려고 {@link #filledPlanInfo()} 와 나눠 뒀다. */
    private static PlanInfo walkPlanInfo() {
        return PlanInfo.builder()
            .planId(1234567890123456789L)
            .petId(987654321098765432L)
            .petIds(List.of(987654321098765432L))
            .areaCode("39")
            .title("올레 걷기")
            .startDate(LocalDate.of(2026, 9, 12))
            .endDate(LocalDate.of(2026, 9, 12))
            .status(PlanStatus.CONFIRMED)
            .totalDays(1)
            .items(List.of(PlanItemInfo.builder()
                .planItemId(555555555555555557L)
                .day(1)
                .sequence(0)
                .itemType(PlanItemType.WALK)
                .targetId(212481712381923329L)
                .title("1코스 걷기")
                .visited(false)
                .walkCourse(PlanItemWalkCourseInfo.builder()
                    .name("시흥-광치기")
                    .courseLabel("1코스")
                    .distanceKm(new BigDecimal("15.1"))
                    .durationText("4~5시간")
                    .durationMaxMinutes(300)
                    .lat(33.4796218839d)
                    .lng(126.8955024257d)
                    .firstImage("http://tong.visitkorea.or.kr/cms/resource/2.jpg")
                    .fitsActivityLevels(List.of(PlanItemWalkCourseInfo.ActivityFit.builder()
                        .code("MEDIUM")
                        .name("보통")
                        .description("일반적인 산책과 관광 일정을 소화합니다.")
                        .build()))
                    .build())
                .build()))
            .build();
    }

    /** 감출 값을 <b>전부 채운</b> 입력이다. 비워 두면 "안 새는 것" 과 "애초에 없는 것" 이 구분되지 않는다. */
    private static PlanInfo filledPlanInfo() {
        return PlanInfo.builder()
            .planId(1234567890123456789L)
            .petId(987654321098765432L)
            .petIds(List.of(987654321098765432L, 987654321098765433L))
            .areaCode("39")
            .sigunguCode("4")
            .title("몽실이와 제주 2박 3일")
            .startDate(LocalDate.of(2026, 9, 12))
            .endDate(LocalDate.of(2026, 9, 14))
            .budget(400000)
            .status(PlanStatus.CONFIRMED)
            .totalDays(3)
            .items(List.of(
                PlanItemInfo.builder()
                    .planItemId(555555555555555555L)
                    .day(1)
                    .sequence(0)
                    .itemType(PlanItemType.PLACE)
                    .targetId(212481712381923328L)
                    .title("천지연폭포")
                    .memo("그늘이 많아 더위에 약한 아이도 괜찮음")
                    .startTime(LocalTime.of(10, 30))
                    .visited(true)
                    .place(PlanItemPlaceInfo.builder()
                        .addr1("제주특별자치도 서귀포시 천지동")
                        .indoor(false)
                        .firstImage("http://tong.visitkorea.or.kr/cms/resource/1.jpg")
                        .lat(33.2469)
                        .lng(126.5543)
                        .build())
                    .build(),
                PlanItemInfo.builder()
                    .planItemId(555555555555555556L)
                    .day(1)
                    .sequence(1)
                    .itemType(PlanItemType.MOVE)
                    .title("숙소로 이동")
                    .memo("주차 미리 확인")
                    .visited(false)
                    .build()))
            .build();
    }
}
