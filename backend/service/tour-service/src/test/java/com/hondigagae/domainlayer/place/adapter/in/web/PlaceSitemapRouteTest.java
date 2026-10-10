package com.hondigagae.domainlayer.place.adapter.in.web;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hondigagae.domainlayer.place.adapter.in.web.controller.PlaceWebController;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.item.PlaceSitemapItem;
import com.hondigagae.domainlayer.place.adapter.in.web.dto.response.PlaceSitemapResponse;
import com.hondigagae.domainlayer.place.adapter.in.web.exception.PlaceExceptionHandler;
import com.hondigagae.domainlayer.place.application.port.in.PlaceWebUseCase;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.time.LocalDateTime;
import java.util.List;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * {@code /api/v1/places/sitemap} 이 {@code /{placeId}} 로 잡히지 않는가 (#1135).
 *
 * <p>리터럴 경로가 패턴 변수보다 우선하는 것은 Spring MVC 의 규칙이지만, 어긋나면 {@code "sitemap"} 을
 * long 으로 바꾸다 실패한 400(PLACE 타입 불일치)이 나가고 컴파일로는 잡히지 않는다. 응답 봉투와
 * 직렬화 모양(아이디 문자열, 동반 구분 metadata, ISO 날짜와 null)도 여기서 함께 고정한다.
 */
@WebMvcTest(controllers = PlaceWebController.class)
@Import(PlaceExceptionHandler.class)
class PlaceSitemapRouteTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PlaceWebUseCase placeWebUseCase;

    @Test
    @DisplayName("/sitemap 은 사이트맵 유스케이스로 가고 상세 조회로 가지 않는다")
    void sitemapIsNotCapturedByPlaceIdPattern() throws Exception {
        given(placeWebUseCase.getSitemapPlaces()).willReturn(PlaceSitemapResponse.builder()
            .places(List.of(
                PlaceSitemapItem.builder()
                    .placeId("212481712381923328")
                    .petAllowanceType(PetAllowanceType.ALLOWED.toMetadata())
                    .modifiedAt(LocalDateTime.of(2026, 8, 27, 14, 30, 5))
                    .build(),
                PlaceSitemapItem.builder()
                    .placeId("4611952987747030849")
                    .petAllowanceType(PetAllowanceType.UNKNOWN.toMetadata())
                    .modifiedAt(null)
                    .build()))
            .totalCount(2)
            .build());

        mockMvc.perform(get("/api/v1/places/sitemap"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dataHeader.success").value(true))
            .andExpect(jsonPath("$.dataBody.totalCount").value(2))
            .andExpect(jsonPath("$.dataBody.places[0].placeId").value("212481712381923328"))
            .andExpect(jsonPath("$.dataBody.places[0].petAllowanceType.code").value("ALLOWED"))
            .andExpect(jsonPath("$.dataBody.places[0].petAllowanceType.name").value("동반 가능"))
            .andExpect(jsonPath("$.dataBody.places[0].modifiedAt").value("2026-08-27T14:30:05"))
            .andExpect(jsonPath("$.dataBody.places[1].petAllowanceType.code").value("UNKNOWN"))
            .andExpect(jsonPath("$.dataBody.places[1].modifiedAt").value(Matchers.nullValue()));

        verify(placeWebUseCase).getSitemapPlaces();
        verify(placeWebUseCase, never()).getPlaceDetail(anyLong());
    }

    @Test
    @DisplayName("숫자 아이디는 여전히 상세 조회로 간다 — 리터럴 경로를 더해도 패턴 경로는 그대로다")
    void numericIdStillRoutesToDetail() throws Exception {
        mockMvc.perform(get("/api/v1/places/126434"))
            .andExpect(status().isOk());

        verify(placeWebUseCase).getPlaceDetail(126_434L);
        verify(placeWebUseCase, never()).getSitemapPlaces();
    }
}
