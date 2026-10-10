package com.hondigagae.domainlayer.place.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hondigagae.domainlayer.place.adapter.in.web.controller.PlaceWebController;
import com.hondigagae.domainlayer.place.adapter.in.web.exception.PlaceExceptionHandler;
import com.hondigagae.domainlayer.place.application.model.PlaceSearchCriteria;
import com.hondigagae.domainlayer.place.application.port.in.PlaceWebUseCase;
import com.hondigagae.persistence.dto.SliceResponse;
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
 * 장소 목록의 기준 좌표 파라미터 (#1202).
 *
 * <p>좌표는 둘이 함께 와야 뜻이 있다. 하나만 오면 조용히 id 순으로 떨어뜨리지 않고 400 으로 거절한다 —
 * 그러면 클라이언트는 좌표를 빠뜨린 줄 모르고 id 순 목록을 "가까운 순" 이라고 그린다.
 */
@WebMvcTest(controllers = PlaceWebController.class)
@Import(PlaceExceptionHandler.class)
class PlaceDistanceParameterValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PlaceWebUseCase placeWebUseCase;

    @ParameterizedTest
    @ValueSource(strings = {"lat", "lng"})
    @DisplayName("lat 과 lng 중 하나만 오면 PLACE_109 로 거절하고 유스케이스를 부르지 않는다")
    void rejectsHalfOrigin(String only) throws Exception {
        mockMvc.perform(get("/api/v1/places").param(only, "lat".equals(only) ? "33.2541" : "126.4129"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.dataHeader.resultCode").value("PLACE_109"));

        verifyNoInteractions(placeWebUseCase);
    }

    @Test
    @DisplayName("위도가 범위를 벗어나면 lat 필드 PLACE_103 이다")
    void rejectsLatOutOfRange() throws Exception {
        mockMvc.perform(get("/api/v1/places").param("lat", "91").param("lng", "126.4129"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.dataHeader.resultCode").value("PLACE_103"))
            .andExpect(jsonPath("$.dataHeader.fieldErrors[0].field").value("lat"));

        verifyNoInteractions(placeWebUseCase);
    }

    @Test
    @DisplayName("경도가 범위를 벗어나면 lng 필드 PLACE_104 다")
    void rejectsLngOutOfRange() throws Exception {
        mockMvc.perform(get("/api/v1/places").param("lat", "33.2541").param("lng", "-181"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.dataHeader.resultCode").value("PLACE_104"))
            .andExpect(jsonPath("$.dataHeader.fieldErrors[0].field").value("lng"));

        verifyNoInteractions(placeWebUseCase);
    }

    @Test
    @DisplayName("둘 다 오면 조건에 그대로 실려 유스케이스로 간다 — 커서는 그대로 lastPlaceId 다")
    void passesOriginAndCursor() throws Exception {
        when(placeWebUseCase.getPlaces(any())).thenReturn(new SliceResponse<>(List.of(), false));

        mockMvc.perform(get("/api/v1/places")
                .param("lat", "33.2541").param("lng", "126.4129").param("contentType", "RESTAURANT").param("lastPlaceId", "126434"))
            .andExpect(status().isOk());

        ArgumentCaptor<PlaceSearchCriteria> captor = ArgumentCaptor.forClass(PlaceSearchCriteria.class);
        verify(placeWebUseCase).getPlaces(captor.capture());
        assertThat(captor.getValue().lat()).isEqualTo(33.2541d);
        assertThat(captor.getValue().lng()).isEqualTo(126.4129d);
        assertThat(captor.getValue().lastPlaceId()).isEqualTo(126434L);
        assertThat(captor.getValue().hasOrigin()).isTrue();
    }

    @Test
    @DisplayName("둘 다 없으면 좌표 없는 조건이다 — 예전과 같은 id 순 목록")
    void noOriginStaysIdOrder() throws Exception {
        when(placeWebUseCase.getPlaces(any())).thenReturn(new SliceResponse<>(List.of(), false));

        mockMvc.perform(get("/api/v1/places").param("areaCode", "39"))
            .andExpect(status().isOk());

        ArgumentCaptor<PlaceSearchCriteria> captor = ArgumentCaptor.forClass(PlaceSearchCriteria.class);
        verify(placeWebUseCase).getPlaces(captor.capture());
        assertThat(captor.getValue().lat()).isNull();
        assertThat(captor.getValue().lng()).isNull();
        assertThat(captor.getValue().hasOrigin()).isFalse();
    }
}
