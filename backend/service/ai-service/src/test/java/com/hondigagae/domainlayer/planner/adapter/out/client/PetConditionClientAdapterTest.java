package com.hondigagae.domainlayer.planner.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.hondigagae.common.dto.Response;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.PetConditionClient;
import com.hondigagae.domainlayer.planner.adapter.out.client.feign.dto.PetConditionClientResponse;
import com.hondigagae.domainlayer.planner.adapter.out.client.support.InternalResponseSupport;
import com.hondigagae.domainlayer.planner.application.model.PetCondition;
import com.hondigagae.shared.travel.pet.PetSizeType;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 반려견 특성의 크기 · 체중 원본 값 매핑 (#1420).
 *
 * <p>동행견 입장 판정({@code PetAdmission})은 표기({@code sizeName} · {@code weightText})가 아니라 원본 값({@code sizeType} ·
 * {@code weightKg})을 쓴다. <b>이 매핑이 빠지면 #1420 증상이 조용히 돌아온다</b> — 체중을 아는 20kg 중형견이 체중 미상으로 읽혀
 * 중형견 하한 10kg 으로 판정되고, 15kg 이하 숙소에 다시 들어간다. 프롬프트 표기는 그대로라 화면에서도 드러나지 않는다.
 */
@ExtendWith(MockitoExtension.class)
class PetConditionClientAdapterTest {

    private static final long MEMBER_ID = 7L;

    @Mock
    private PetConditionClient petConditionClient;

    @Test
    @DisplayName("크기 코드와 체중을 원본 값으로 옮기고 표기도 같은 값에서 만든다")
    void mapsSizeTypeAndWeight() {
        when(petConditionClient.getPetConditions(MEMBER_ID, List.of(1L)))
            .thenReturn(Response.success(List.of(response("MEDIUM", new BigDecimal("20.0")))));

        assertThat(adapter().findConditions(MEMBER_ID, List.of(1L))).singleElement().satisfies(pet -> {
            assertThat(pet.sizeType()).isEqualTo(PetSizeType.MEDIUM);
            assertThat(pet.weightKg()).isEqualByComparingTo("20");
            assertThat(pet.sizeName()).isEqualTo("중형견");
            assertThat(pet.weightText()).isEqualTo("20");
        });
    }

    @Test
    @DisplayName("모르는 크기 코드 · 크기 없음은 null 이다 — 지어 적지 않는다")
    void unknownOrMissingSizeTypeBecomesNull() {
        when(petConditionClient.getPetConditions(MEMBER_ID, List.of(1L, 2L)))
            .thenReturn(Response.success(List.of(response("HUGE", null), response(null, null))));

        List<PetCondition> pets = adapter().findConditions(MEMBER_ID, List.of(1L, 2L));

        assertThat(pets).extracting(PetCondition::sizeType).containsExactly(null, null);
        assertThat(pets).extracting(PetCondition::sizeName).containsExactly(null, null);
        assertThat(pets).extracting(PetCondition::weightKg).containsExactly(null, null);
    }

    @Test
    @DisplayName("대표 반려견도 같은 매핑을 탄다 — 반려견을 지정하지 않은 일정의 입장 판정 근거다")
    void representativeUsesTheSameMapping() {
        when(petConditionClient.getRepresentativePetCondition(MEMBER_ID))
            .thenReturn(Response.success(response("LARGE", new BigDecimal("31.5"))));

        assertThat(adapter().findRepresentativeCondition(MEMBER_ID)).hasValueSatisfying(pet -> {
            assertThat(pet.sizeType()).isEqualTo(PetSizeType.LARGE);
            assertThat(pet.weightKg()).isEqualByComparingTo("31.5");
            assertThat(pet.sizeName()).isEqualTo("대형견");
        });
    }

    private PetConditionClientAdapter adapter() {
        return new PetConditionClientAdapter(petConditionClient, new InternalResponseSupport(CircuitBreakerRegistry.ofDefaults()));
    }

    private static PetConditionClientResponse response(String sizeType, BigDecimal weightKg) {
        return new PetConditionClientResponse("1", "웰시코기", sizeType, weightKg, 36, false, false, false, "MEDIUM", true, "MEDIUM");
    }
}
