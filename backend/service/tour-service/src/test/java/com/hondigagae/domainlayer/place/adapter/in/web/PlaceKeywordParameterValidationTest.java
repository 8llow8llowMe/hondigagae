package com.hondigagae.domainlayer.place.adapter.in.web;

import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hondigagae.domainlayer.place.adapter.in.web.controller.PlaceWebController;
import com.hondigagae.domainlayer.place.adapter.in.web.exception.PlaceExceptionHandler;
import com.hondigagae.domainlayer.place.application.port.in.PlaceWebUseCase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = PlaceWebController.class)
@Import(PlaceExceptionHandler.class)
class PlaceKeywordParameterValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PlaceWebUseCase placeWebUseCase;

    @ParameterizedTest
    @ValueSource(strings = {"/api/v1/places", "/api/v1/places/nearby?lat=33.45&lng=126.94"})
    @DisplayName("목록과 주변 검색은 6개 단어를 keyword 필드 PLACE_108 오류로 거부한다")
    void rejectsSixKeywordTokens(String path) throws Exception {
        mockMvc.perform(get(path).param("keyword", "하나  둘\t셋 넷 다섯 여섯"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.dataHeader.resultCode").value("PLACE_108"))
            .andExpect(jsonPath("$.dataHeader.fieldErrors[0].field").value("keyword"));

        verifyNoInteractions(placeWebUseCase);
    }
}
