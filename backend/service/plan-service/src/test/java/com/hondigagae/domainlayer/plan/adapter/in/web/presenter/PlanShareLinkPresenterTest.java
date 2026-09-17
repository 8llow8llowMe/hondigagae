package com.hondigagae.domainlayer.plan.adapter.in.web.presenter;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.item.SharedPlanItemItem;
import com.hondigagae.domainlayer.plan.adapter.in.web.dto.response.SharedPlanResponse;
import com.hondigagae.domainlayer.plan.application.info.PlanInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemInfo;
import com.hondigagae.domainlayer.plan.application.info.PlanItemPlaceInfo;
import com.hondigagae.domainlayer.plan.domain.enums.PlanStatus;
import com.hondigagae.shared.travel.plan.PlanItemType;
import java.lang.reflect.RecordComponent;
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
    @DisplayName("SharedPlanItemItem 의 필드 집합은 정확히 일곱이다 — planItemId·memo·visited 가 없다")
    void sharedPlanItemComponentsArePinned() {
        assertThat(componentNamesOf(SharedPlanItemItem.class)).containsExactlyInAnyOrder(
            "day", "sequence", "itemType", "targetId", "title", "startTime", "place");
    }

    private static Set<String> componentNamesOf(Class<?> recordType) {
        return Arrays.stream(recordType.getRecordComponents())
            .map(RecordComponent::getName)
            .collect(Collectors.toUnmodifiableSet());
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
