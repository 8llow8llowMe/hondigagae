package com.hondigagae.domainlayer.plan.adapter.out.client.feign;

import static org.assertj.core.api.Assertions.assertThat;

import feign.Feign;
import feign.Request;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.OffsetTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.AnnotatedBeanDefinition;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.cloud.openfeign.SpringQueryMap;
import org.springframework.cloud.openfeign.support.SpringMvcContract;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.core.ResolvableType;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.support.DefaultFormattingConversionService;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * tour-service 로 나가는 날짜·시각 쿼리 파라미터가 <b>요청 로케일과 무관하게 ISO</b> 인지 고정한다 (#1419).
 *
 * <p><b>운영에서 일정 항목 산책 위험도가 전부 {@code LOOKUP_FAILED} 였다.</b> Feign 은
 * {@code @RequestParam} 값을 {@code DefaultFormattingConversionService} 로 문자열화하는데, 형식
 * 지정이 없으면 <b>요청 스레드의 로케일({@code LocaleContextHolder})로 SHORT 형식</b>을 쓴다.
 * BFF(Node fetch)는 {@code Accept-Language: *} 를 보내고 Tomcat 은 이를 {@code Locale.ROOT} 로 읽는다.
 * ROOT 의 SHORT 일시는 {@code 2026-10-15 10:00} 이라 tour-service 가 읽지 못해 400 을 줬다. 같은
 * 방식의 날짜({@code LocalDate})가 멀쩡했던 것은 ROOT 의 SHORT 날짜가 우연히 {@code 2026-10-15}
 * 였기 때문이다.
 *
 * <p>지금까지 이 사고를 못 잡은 것은 <b>Feign 이 실제로 만드는 URL 을 본 테스트가 없었기</b>
 * 때문이다 — 어댑터 테스트는 클라이언트를 mock 으로 갈아 끼운다. 그래서 운영 조건(ROOT)과
 * 브라우저 로케일(ko_KR)을 직접 세우고, <b>실제로 나가는 URL</b> 을 찍는다. 변환 서비스는
 * {@code FeignClientsConfiguration.feignConversionService()} 와 같은
 * {@code DefaultFormattingConversionService} 다.
 *
 * <p>받는 쪽은 ISO 를 읽는다 — 운영 tour-service 에 {@code 2026-10-15T10:00:00} 은 200,
 * {@code 2026-10-15 10:00} 은 400 {@code INSIGHT_113} 이었다 (2026-10-13 실측).
 */
class FeignDateParamContractTest {

    private static final LocalDateTime ITEM_AT = LocalDateTime.of(2026, 10, 15, 10, 0);
    private static final LocalDate DAY = LocalDate.of(2026, 10, 15);

    /**
     * 기본값이 <b>로케일 SHORT 형식</b>인 타입과 각자 맞는 ISO 종류. {@code Instant} · {@code Year} 같은
     * 나머지 {@code java.time} 타입은 기본 포매터가 원래 로케일과 무관하고, 여기에 ISO
     * {@code DATE_TIME} 을 붙이면 오히려 변환이 실패하므로 검사하지 않는다.
     */
    private static final Map<Class<?>, DateTimeFormat.ISO> LOCALIZED_BY_DEFAULT = Map.of(
        LocalDate.class, DateTimeFormat.ISO.DATE,
        LocalTime.class, DateTimeFormat.ISO.TIME,
        OffsetTime.class, DateTimeFormat.ISO.TIME,
        LocalDateTime.class, DateTimeFormat.ISO.DATE_TIME,
        ZonedDateTime.class, DateTimeFormat.ISO.DATE_TIME,
        OffsetDateTime.class, DateTimeFormat.ISO.DATE_TIME);

    @AfterEach
    void resetRequestLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    static Stream<Arguments> requestLocales() {
        return Stream.of(
            Arguments.of("ROOT — BFF 의 Accept-Language: * (운영 실패 조건)", Locale.ROOT),
            Arguments.of("ko_KR — 브라우저 Accept-Language", Locale.KOREA),
            Arguments.of("en_US — 컨테이너 기본 로케일", Locale.US));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("requestLocales")
    @DisplayName("산책 위험도 targetDateTime 은 ISO 일시로 나간다")
    void walkSafetySendsIsoDateTime(String label, Locale requestLocale) {
        LocaleContextHolder.setLocale(requestLocale);

        String url = requestUrl(PlaceWalkSafetyClient.class, client -> client.getWalkSafety(
            1L, ITEM_AT, "MEDIUM", false, false, false, null, null));

        assertThat(queryValue(url, "targetDateTime")).isEqualTo("2026-10-15T10:00:00");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("requestLocales")
    @DisplayName("여행 적합도 targetDate 는 ISO 날짜로 나간다")
    void suitabilitySendsIsoDate(String label, Locale requestLocale) {
        LocaleContextHolder.setLocale(requestLocale);

        String url = requestUrl(PlaceSuitabilityClient.class, client -> client.getSuitability(
            1L, DAY, "MEDIUM", false, false, false, null));

        assertThat(queryValue(url, "targetDate")).isEqualTo("2026-10-15");
    }

    /**
     * 다음 클라이언트가 같은 함정을 밟지 않게 한다. 이 서비스의 Feign 인터페이스를 모두 훑어, 쿼리 ·
     * 경로 · 헤더로 문자열화되는 날짜 · 시각 파라미터(컬렉션 원소 포함)에 <b>타입에 맞는</b> ISO
     * {@code @DateTimeFormat} 이 없으면 깨진다. 본문({@code @RequestBody}) · {@code @SpringQueryMap} 은
     * 이 변환을 타지 않으므로 제외한다.
     */
    @Test
    @DisplayName("Feign 클라이언트의 날짜 · 시각 파라미터는 타입에 맞는 ISO @DateTimeFormat 을 단다")
    void everyLocalizedTemporalParameterDeclaresIsoFormat() throws ClassNotFoundException {
        List<Class<?>> clients = feignClients();
        List<String> violations = new ArrayList<>();

        for (Class<?> client : clients) {
            for (Method method : client.getMethods()) {
                Parameter[] parameters = method.getParameters();
                for (int index = 0; index < parameters.length; index++) {
                    Parameter parameter = parameters[index];
                    if (parameter.isAnnotationPresent(RequestBody.class)
                        || parameter.isAnnotationPresent(SpringQueryMap.class)) {
                        continue;
                    }
                    DateTimeFormat.ISO expected = LOCALIZED_BY_DEFAULT.get(valueType(method, index));
                    if (expected == null) {
                        continue;
                    }
                    DateTimeFormat format = parameter.getAnnotation(DateTimeFormat.class);
                    DateTimeFormat.ISO actual = format == null ? null : format.iso();
                    if (actual != expected) {
                        violations.add("%s#%s 파라미터 %d — 기대 %s, 실제 %s".formatted(
                            client.getSimpleName(), method.getName(), index, expected, actual));
                    }
                }
            }
        }

        assertThat(clients).as("스캔이 비어 있으면 이 검사는 아무것도 지키지 않는다")
            .contains(PlaceWalkSafetyClient.class, PlaceSuitabilityClient.class);
        assertThat(violations).as("ISO @DateTimeFormat 이 없거나 종류가 틀린 날짜 · 시각 파라미터").isEmpty();
    }

    /** {@code List<LocalDate>} · {@code LocalDate[]} 도 원소마다 같은 변환을 타므로 원소 타입을 본다. */
    private static Class<?> valueType(Method method, int index) {
        ResolvableType type = ResolvableType.forMethodParameter(method, index);
        if (type.isArray()) {
            return type.getComponentType().resolve();
        }
        if (Iterable.class.isAssignableFrom(type.toClass())) {
            return type.as(Iterable.class).getGeneric(0).resolve();
        }
        return type.resolve();
    }

    private static <T> String requestUrl(Class<T> type, Consumer<T> call) {
        AtomicReference<String> url = new AtomicReference<>();
        T client = Feign.builder()
            .contract(new SpringMvcContract(List.of(), new DefaultFormattingConversionService()))
            .client((Request request, Request.Options options) -> {
                url.set(request.url());
                throw new UrlCaptured();
            })
            .target(type, "http://tour-service");
        try {
            call.accept(client);
        } catch (UrlCaptured expected) {
            // 전송하지 않고 URL 만 잡았다. 그 밖의 예외(변환 실패 등)는 원인 그대로 테스트를 깬다
        }
        assertThat(url.get()).as("Feign 이 요청을 만들지 않았다").isNotNull();
        return url.get();
    }

    /** URL 을 잡은 뒤 전송을 멈추는 신호. 이것만 삼킨다. */
    private static final class UrlCaptured extends RuntimeException {

        UrlCaptured() {
            super("요청 URL 만 본다", null, false, false);
        }
    }

    private static String queryValue(String url, String name) {
        String query = url.substring(url.indexOf('?') + 1);
        for (String pair : query.split("&")) {
            int equals = pair.indexOf('=');
            if (pair.substring(0, equals).equals(name)) {
                return URLDecoder.decode(pair.substring(equals + 1), StandardCharsets.UTF_8);
            }
        }
        throw new AssertionError(name + " 파라미터가 URL 에 없다: " + url);
    }

    private static List<Class<?>> feignClients() throws ClassNotFoundException {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false) {
            @Override
            protected boolean isCandidateComponent(AnnotatedBeanDefinition beanDefinition) {
                return beanDefinition.getMetadata().isInterface();
            }
        };
        scanner.addIncludeFilter(new AnnotationTypeFilter(FeignClient.class));
        Set<BeanDefinition> found = scanner.findCandidateComponents("com.hondigagae");

        List<Class<?>> clients = new ArrayList<>();
        for (BeanDefinition definition : found) {
            clients.add(Class.forName(definition.getBeanClassName()));
        }
        return clients;
    }
}
