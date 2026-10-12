package com.hondigagae.domainlayer.insight.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hondigagae.domainlayer.insight.adapter.in.web.controller.PlaceInsightWebController;
import com.hondigagae.domainlayer.insight.adapter.in.web.dto.response.PlaceRecommendationResponse;
import com.hondigagae.domainlayer.insight.adapter.in.web.exception.InsightExceptionHandler;
import com.hondigagae.domainlayer.insight.application.model.PlaceRecommendationQuery;
import com.hondigagae.domainlayer.insight.application.port.in.PlaceInsightWebUseCase;
import com.hondigagae.domainlayer.place.adapter.in.web.controller.PlaceWebController;
import com.hondigagae.domainlayer.place.adapter.in.web.exception.PlaceExceptionHandler;
import com.hondigagae.domainlayer.place.application.port.in.PlaceWebUseCase;
import com.hondigagae.shared.travel.pet.PetSizeType;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * {@code /api/v1/places/recommendations} 가 장소 상세 {@code /{placeId}} 로 잡히지 않는가, 개수 검증이 봉투째 400 인가 (#1368).
 *
 * <p>두 경로는 다른 컨트롤러(place · insight)에 있어 한 슬라이스에 함께 올린다. 리터럴 경로가 패턴 변수보다 우선하는 것은
 * Spring MVC 규칙이지만, 어긋나면 {@code "recommendations"} 를 long 으로 바꾸다 실패한 400 이 나가고 컴파일로는 잡히지 않는다.
 */
@WebMvcTest(controllers = {PlaceWebController.class, PlaceInsightWebController.class})
@Import({PlaceExceptionHandler.class, InsightExceptionHandler.class})
class PlaceRecommendationRouteTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PlaceWebUseCase placeWebUseCase;

    @MockitoBean
    private PlaceInsightWebUseCase placeInsightWebUseCase;

    @Test
    @DisplayName("/recommendations 는 추천 유스케이스로 가고 상세 조회로 가지 않는다 — 기본 개수 3, 조건 없음")
    void recommendationsIsNotCapturedByPlaceIdPattern() throws Exception {
        when(placeInsightWebUseCase.getRecommendations(any())).thenReturn(PlaceRecommendationResponse.builder()
            .targetDate(LocalDate.of(2026, 10, 11))
            .weatherProviderName("기상청 단기예보")
            .items(List.of())
            .build());

        mockMvc.perform(get("/api/v1/places/recommendations"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dataHeader.success").value(true))
            .andExpect(jsonPath("$.dataBody.targetDate").value("2026-10-11"))
            .andExpect(jsonPath("$.dataBody.items").isEmpty());

        ArgumentCaptor<PlaceRecommendationQuery> captor = ArgumentCaptor.forClass(PlaceRecommendationQuery.class);
        verify(placeInsightWebUseCase).getRecommendations(captor.capture());
        assertThat(captor.getValue().limit()).isEqualTo(3);
        assertThat(captor.getValue().targetDate()).isNull();
        assertThat(captor.getValue().petCondition().isSpecified()).isFalse();
        verify(placeWebUseCase, never()).getPlaceDetail(anyLong());
    }

    @Test
    @DisplayName("반려견 조건과 개수가 그대로 실려 간다")
    void passesPetConditionAndLimit() throws Exception {
        when(placeInsightWebUseCase.getRecommendations(any())).thenReturn(PlaceRecommendationResponse.builder().items(List.of()).build());

        mockMvc.perform(get("/api/v1/places/recommendations")
                .param("targetDate", "2026-09-10").param("petSizeType", "SMALL").param("heatSensitive", "true")
                .param("breed", "퍼그").param("limit", "10"))
            .andExpect(status().isOk());

        ArgumentCaptor<PlaceRecommendationQuery> captor = ArgumentCaptor.forClass(PlaceRecommendationQuery.class);
        verify(placeInsightWebUseCase).getRecommendations(captor.capture());
        assertThat(captor.getValue().limit()).isEqualTo(10);
        assertThat(captor.getValue().targetDate()).isEqualTo(LocalDate.of(2026, 9, 10));
        assertThat(captor.getValue().petCondition().sizeType()).isEqualTo(PetSizeType.SMALL);
        assertThat(captor.getValue().petCondition().heatSensitive()).isTrue();
        assertThat(captor.getValue().petCondition().breed()).isEqualTo("퍼그");
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "11"})
    @DisplayName("개수가 1~10 밖이면 INSIGHT_105 로 거절하고 유스케이스를 부르지 않는다")
    void rejectsLimitOutOfRange(String limit) throws Exception {
        mockMvc.perform(get("/api/v1/places/recommendations").param("limit", limit))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.dataHeader.success").value(false))
            .andExpect(jsonPath("$.dataHeader.resultCode").value("INSIGHT_105"));

        verifyNoInteractions(placeInsightWebUseCase);
    }

    @Test
    @DisplayName("숫자 아이디는 여전히 상세 조회로 간다 — 리터럴 경로를 더해도 패턴 경로는 그대로다")
    void numericIdStillRoutesToDetail() throws Exception {
        mockMvc.perform(get("/api/v1/places/126434"))
            .andExpect(status().isOk());

        verify(placeWebUseCase).getPlaceDetail(126_434L);
        verifyNoInteractions(placeInsightWebUseCase);
    }
}
