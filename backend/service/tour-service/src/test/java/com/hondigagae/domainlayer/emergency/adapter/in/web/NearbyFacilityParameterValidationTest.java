package com.hondigagae.domainlayer.emergency.adapter.in.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hondigagae.domainlayer.emergency.adapter.in.web.controller.NearbyFacilityWebController;
import com.hondigagae.domainlayer.emergency.adapter.in.web.exception.EmergencyExceptionHandler;
import com.hondigagae.domainlayer.emergency.application.port.in.NearbyFacilityWebUseCase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 필수 쿼리 파라미터가 없을 때의 응답 계약 검증.
 *
 * <p><b>이 테스트가 있는 이유</b>는 두 가지가 코드만 봐서는 확정되지 않기 때문이다.
 *
 * <ol>
 *   <li>핸들러가 없으면 스프링 기본 응답이 나가 Response 봉투 밖 형태가 된다. 클라이언트는
 *       모든 오류를 같은 봉투로 받는다고 전제하므로 이 한 경우만 형태가 달라지면 파싱이 깨진다</li>
 *   <li>{@code @RequestParam Double lat} 에 붙은 {@code @NotNull} 이 실제로 실행되는지 -
 *       값이 비어 온 경우({@code ?lat=})까지 확인해야 알 수 있다</li>
 * </ol>
 *
 * <p>2번의 답이 "실행되지 않는다"라서 컨트롤러의 {@code @NotNull} 을 걷어냈다. 근거를
 * 주석이 아니라 테스트로 남긴다 - 스프링 버전이 올라가며 동작이 바뀌면 여기서 먼저 깨진다.
 */
@WebMvcTest(controllers = NearbyFacilityWebController.class)
@Import(EmergencyExceptionHandler.class)
class NearbyFacilityParameterValidationTest {

    private static final String PATH = "/api/v1/emergencies/facilities";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private NearbyFacilityWebUseCase nearbyFacilityWebUseCase;

    @Test
    @DisplayName("필수 파라미터가 아예 없으면 EMERGENCY_114 를 Response 봉투로 돌려준다")
    void respondsWithEnvelopeWhenParameterAbsent() throws Exception {
        mockMvc.perform(get(PATH))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.dataHeader.resultCode").value("EMERGENCY_114"))
            // 파라미터가 여럿인 엔드포인트라 어느 것이 빠졌는지 메시지에 담긴다.
            .andExpect(jsonPath("$.dataHeader.resultMessage").value(org.hamcrest.Matchers.containsString("lat")));
    }

    @Test
    @DisplayName("값이 비어 와도(?lat=) 같은 경로로 처리된다 - @NotNull 이 아니다")
    void respondsWithEnvelopeWhenParameterIsBlank() throws Exception {
        // 이것이 컨트롤러에서 @NotNull 을 걷어낸 근거다. 비어 온 값도 Bean Validation 이
        // 아니라 MissingServletRequestParameterException 으로 처리된다.
        mockMvc.perform(get(PATH).param("lat", "").param("lng", "126.5"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.dataHeader.resultCode").value("EMERGENCY_114"));
    }

    @Test
    @DisplayName("범위를 벗어난 값은 @Min/@Max 가 잡아 개별 코드를 준다")
    void respondsWithFieldCodeWhenOutOfRange() throws Exception {
        // 값이 들어온 뒤에는 Bean Validation 이 정상 동작한다. @NotNull 만 닿지 않는다.
        mockMvc.perform(get(PATH).param("lat", "999").param("lng", "126.5"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.dataHeader.resultCode").value("EMERGENCY_101"));
    }
}
