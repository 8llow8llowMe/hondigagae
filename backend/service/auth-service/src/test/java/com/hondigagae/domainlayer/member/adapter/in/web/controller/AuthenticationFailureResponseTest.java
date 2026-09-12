package com.hondigagae.domainlayer.member.adapter.in.web.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.hondigagae.domainlayer.auth.adapter.in.web.provider.RefreshCookieProvider;
import com.hondigagae.domainlayer.member.application.port.in.MemberWebUseCase;
import com.hondigagae.domainlayer.pet.adapter.in.web.controller.PetWebController;
import com.hondigagae.domainlayer.pet.application.port.in.PetWebUseCase;
import com.hondigagae.security.auth.config.AuthSecurityConfigurer;
import com.hondigagae.security.auth.config.JwtAuthPropertiesConfig;
import com.hondigagae.security.auth.jwt.JwtAuthProperties;
import com.hondigagae.security.auth.jwt.JwtAuthProvider;
import com.hondigagae.security.common.enums.SecurityRole;
import java.time.Duration;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 인증 필터 체인을 실제로 통과시켜 <b>어떤 Authorization 갈래도 Response 봉투 밖으로 나가지 않는지</b> 고정한다 (이슈 #214).
 *
 * <p>단위 테스트({@code JwtAuthProviderTest}·{@code JwtAuthFilterTest})는 예외 매핑과 필터 한 겹을 본다. 여기서는
 * {@code AuthSecurityConfigurer} 가 조립한 체인 + {@code @PreAuthorize} + security-core 의 기본 writer 를
 * 그대로 태워, 이슈 표의 여섯 갈래가 전부 {@code dataHeader.resultCode} 를 가진 401 인지 본다. 토큰 없음이 403 빈 응답으로
 * 나가던 갈래(Spring 기본 진입점)와 서명부 디코딩 불가가 500 으로 나가던 갈래가 이 테스트가 잡는 회귀다.
 */
@WebMvcTest(controllers = {MemberWebController.class, PetWebController.class})
@Import({AuthSecurityConfigurer.class, JwtAuthPropertiesConfig.class})
@TestPropertySource(properties = {
    "jwt.access-key=hondigagae-test-jwt-access-key-0123456789abcdef0123456789abcdef0123456789abcdef",
    "jwt.access-expiration=30m",
    "jwt.refresh-key=hondigagae-test-jwt-refresh-key-0123456789abcdef0123456789abcdef0123456789abcdef",
    "jwt.refresh-expiration=14d",
    "spring.cloud.config.enabled=false",
    "spring.cloud.discovery.enabled=false",
    "eureka.client.enabled=false"
})
class AuthenticationFailureResponseTest {

    private static final String OTHER_KEY = "hondigagae-test-jwt-other--key-0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final String HEADER = "eyJhbGciOiJIUzI1NiJ9";
    private static final String PAYLOAD = "eyJzdWIiOiIxIn0";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtAuthProvider jwtAuthProvider;

    @MockitoBean
    private MemberWebUseCase memberWebUseCase;

    @MockitoBean
    private RefreshCookieProvider refreshCookieProvider;

    @MockitoBean
    private PetWebUseCase petWebUseCase;

    /** 이슈 #214 표. 게이트웨이 몫이던 "헤더 없음" 도 auth-service 직결 경로에서는 이 서비스가 답한다. */
    static Stream<Arguments> authorizationCases() {
        return Stream.of(
            Arguments.of("헤더 없음", null, "SECURITY_001"),
            Arguments.of("2파트 — aa.bb", "Bearer aa.bb", "SECURITY_003"),
            Arguments.of("디코딩 불가 문자 — h.p.!!!", "Bearer " + HEADER + "." + PAYLOAD + ".!!!", "SECURITY_003"),
            Arguments.of("서명 불일치 — h.p.AAAA", "Bearer " + HEADER + "." + PAYLOAD + ".AAAA", "SECURITY_004"),
            Arguments.of("만료 + 서명 불일치", "Bearer " + expiredSignedWithOtherKey(), "SECURITY_004"),
            Arguments.of("디코딩 불가 길이 — h.p.x (500 이던 갈래)", "Bearer " + HEADER + "." + PAYLOAD + ".x", "SECURITY_003")
        );
    }

    @ParameterizedTest(name = "{0} → 401 {2}")
    @MethodSource("authorizationCases")
    @DisplayName("인증 실패는 전부 Response 봉투 안의 401 이다")
    void everyAuthenticationFailureIsWrapped401(String description, String authorization, String expectedCode) throws Exception {
        var request = get("/api/v1/members/me");
        if (authorization != null) {
            request.header(HttpHeaders.AUTHORIZATION, authorization);
        }

        mockMvc.perform(request)
            .andExpect(status().isUnauthorized())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.dataHeader.success").value(false))
            .andExpect(jsonPath("$.dataHeader.resultCode").value(expectedCode));
    }

    @Test
    @DisplayName("정상 토큰은 컨트롤러까지 간다")
    void validTokenReachesController() throws Exception {
        String token = jwtAuthProvider.issueAccessToken(42L, SecurityRole.USER);

        mockMvc.perform(get("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dataHeader.success").value(true));
    }

    @Test
    @DisplayName("enum 에 없는 값을 보낸 본문은 봉투 안의 400 이고 어느 필드인지 말한다 — pet 공통명세 S6-3")
    void unreadableBodyIsWrapped400() throws Exception {
        String token = jwtAuthProvider.issueAccessToken(42L, SecurityRole.USER);

        mockMvc.perform(post("/api/v1/members/me/pets")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"몽실이\",\"sizeType\":\"HUGE\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.dataHeader.success").value(false))
            .andExpect(jsonPath("$.dataHeader.resultCode").value("MEMBER_100"))
            // 필드 정보는 fieldErrors 로 나간다. resultMessage 는 오류 종류와 무관하게 문자열이다 (#491).
            .andExpect(jsonPath("$.dataHeader.resultMessage").isString())
            .andExpect(jsonPath("$.dataHeader.fieldErrors[0].field").value("sizeType"));
    }

    @Test
    @DisplayName("깨진 JSON 도 봉투 안의 400 이다")
    void brokenJsonIsWrapped400() throws Exception {
        String token = jwtAuthProvider.issueAccessToken(42L, SecurityRole.USER);

        mockMvc.perform(post("/api/v1/members/me/pets")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": "))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.dataHeader.resultCode").value("MEMBER_100"));
    }

    /** 다른 키로, 만료 시각이 이미 지난 토큰. 발급기를 음수 만료로 돌리면 jjwt 를 직접 쓰지 않고도 만들 수 있다. */
    private static String expiredSignedWithOtherKey() {
        JwtAuthProvider otherIssuer = new JwtAuthProvider(
            new JwtAuthProperties(OTHER_KEY, Duration.ofMinutes(-1), OTHER_KEY, Duration.ofMinutes(-1)));
        return otherIssuer.issueAccessToken(1L, SecurityRole.USER);
    }
}
