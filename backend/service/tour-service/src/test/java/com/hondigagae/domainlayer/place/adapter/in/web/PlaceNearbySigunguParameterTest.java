package com.hondigagae.domainlayer.place.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hondigagae.domainlayer.place.adapter.in.web.controller.PlaceWebController;
import com.hondigagae.domainlayer.place.adapter.in.web.exception.PlaceExceptionHandler;
import com.hondigagae.domainlayer.place.application.model.NearbyPlaceCriteria;
import com.hondigagae.domainlayer.place.application.port.in.PlaceWebUseCase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 주변 검색의 시군구 파라미터 (#1316).
 *
 * <p>지도의 "이 지역에서 재검색" 이 목록 조회에서 주변 검색으로 바뀌어도 시군구 필터가 남아야 한다. 생략하면 예전과 같다.
 */
@WebMvcTest(controllers = PlaceWebController.class)
@Import(PlaceExceptionHandler.class)
class PlaceNearbySigunguParameterTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PlaceWebUseCase placeWebUseCase;

    @Test
    @DisplayName("sigunguCode 를 보내면 주변 검색 조건에 그대로 실린다")
    void passesSigunguCode() throws Exception {
        mockMvc.perform(get("/api/v1/places/nearby").param("lat", "33.4996").param("lng", "126.5312").param("sigunguCode", "4"))
            .andExpect(status().isOk());

        NearbyPlaceCriteria criteria = capture();
        assertThat(criteria.sigunguCode()).isEqualTo("4");
        assertThat(criteria.lat()).isEqualTo(33.4996d);
        assertThat(criteria.radius()).isEqualTo(5000);
    }

    @Test
    @DisplayName("sigunguCode 를 생략하면 조건이 null 이다 — 시군구 제한 없는 예전 동작")
    void omittedSigunguCodeIsNull() throws Exception {
        mockMvc.perform(get("/api/v1/places/nearby").param("lat", "33.4996").param("lng", "126.5312"))
            .andExpect(status().isOk());

        assertThat(capture().sigunguCode()).isNull();
    }

    @Test
    @DisplayName("빈 sigunguCode 는 생략과 같게 null 로 실린다 — 0건 결과가 생략 요청의 캐시 키로 들어가지 않게")
    void blankSigunguCodeIsNull() throws Exception {
        mockMvc.perform(get("/api/v1/places/nearby").param("lat", "33.4996").param("lng", "126.5312").param("sigunguCode", ""))
            .andExpect(status().isOk());

        assertThat(capture().sigunguCode()).isNull();
    }

    private NearbyPlaceCriteria capture() {
        ArgumentCaptor<NearbyPlaceCriteria> captor = ArgumentCaptor.forClass(NearbyPlaceCriteria.class);
        verify(placeWebUseCase).getNearbyPlaces(captor.capture());
        return captor.getValue();
    }
}
