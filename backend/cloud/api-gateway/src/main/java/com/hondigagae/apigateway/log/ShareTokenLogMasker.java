package com.hondigagae.apigateway.log;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import org.springframework.http.server.PathContainer;
import org.springframework.http.server.PathContainer.Element;
import org.springframework.http.server.PathContainer.PathSegment;

/**
 * 일정 공유 토큰을 게이트웨이 로그에서 지우는 <b>단일 기준점</b> (#627, #1281).
 *
 * <h2>왜 가리나</h2>
 *
 * <p>{@code /api/v1/shared-plans/{token}} 의 토큰은 <b>그 자체가 열람 권한</b>이다 — 인증 없이 토큰만으로 남의 일정이 열린다.
 * 게이트웨이 로그에 경로가 평문으로 쌓이면 Loki 를 볼 수 있는 사람은 누구나 그 일정을 열 수 있다. 로깅 필터가
 * {@code Authorization} 을 값 없이 <b>존재 여부만</b> 찍는 것과 같은 취지다.
 *
 * <p>경로를 찍는 줄은 두 갈래로 이 규칙을 거친다.
 * <ul>
 *   <li><b>우리 줄은 직접 부른다</b> — 요청·응답·오류응답·지연요청({@code LoggingGlobalApiGatewayFilter}), JWT 거부
 *       ({@code JwtAuthExceptionWebHandler} — JWT 필터가 전역이라 공유 경로에도 걸린다)</li>
 *   <li><b>프레임워크 줄은 출력 단계에서 거친다</b> — 부트 오류 핸들러의 500, {@code HttpWebHandlerAdapter}, 스택트레이스 속
 *       체크포인트는 고칠 자리가 없어 {@code logback-spring.xml} 의 {@link ShareTokenMaskingConverter} 가 렌더된 문자열에서 가린다</li>
 * </ul>
 *
 * <p>가리는 것은 둘이다 — {@code shared-plans} 세그먼트 뒤 <b>한 세그먼트</b>와 쿼리스트링의 {@code token=} 값. 그 밖(호스트·
 * 경로·다른 파라미터)은 그대로 남긴다. 어느 경로였는지는 로그에 남아야 장애를 추적할 수 있다. 쿼리의 {@code token=} 은 지금
 * 계약에 없지만, 토큰을 쿼리로 옮기거나 덧붙이는 변경이 오면 마스킹 밖으로 빠져나가는 회귀 경로라 미리 막아 둔다.
 *
 * <h2>라우팅과 같은 방식으로 읽는다 (#1281)</h2>
 *
 * <p>게이트웨이 라우트 술어({@code PathPattern})와 plan-service 의 {@code @PathVariable} 은 원문이 아니라 <b>퍼센트 디코딩하고
 * {@code ;매개변수} 를 뗀 세그먼트</b>로 맞춘다. 원문에서 {@code "/api/v1/shared-plans/"} 를 찾으면 {@code shared-%70lans} 나
 * {@code shared-plans;x=1} 처럼 표기만 바꾼 요청이 라우트를 타고 일정을 여는데도 로그에는 토큰이 평문으로 남는다. 그래서 같은
 * {@link PathContainer} 로 읽어 세그먼트를 고르고, 지울 때는 그 세그먼트의 <b>원문 전체</b>(매개변수 포함)를 지운다. 라우트는
 * 대소문자를 가리지만 이름 비교는 가리지 않는다 — 라우트보다 넓게 가리는 쪽은 무해하다.
 *
 * <h2>로그 문 안에서 불린다 — 예외를 던지지 않는다</h2>
 *
 * <p>여기서 던지면 로그 한 줄 때문에 요청이 실패하거나 원래 오류가 묻힌다. 경로를 읽지 못하면(깨진 {@code %} 인코딩) 토큰이
 * 섞였을 수 있으니 원문을 남기지 않고 {@link #UNPARSABLE_PATH} 를 돌려준다. 이름을 디코딩하지 못한 쿼리 파라미터는 값을 가린다.
 *
 * <p><b>이 마스킹은 완결된 방어가 아니다.</b> 앞단 nginx access log 는 여전히 전체 경로를 평문으로 남긴다
 * ({@code backend/docs/services/plan-service.md} 의 "남은 위험").
 */
public final class ShareTokenLogMasker {

    public static final String MASKED = "***";
    public static final String UNPARSABLE_PATH = "<해석 불가 경로>";

    private static final String SHARED_PLAN_SEGMENT = "shared-plans";
    private static final String TOKEN_QUERY_PARAMETER = "token";
    private static final String QUERY_PARAMETER_SEPARATOR = "&";
    private static final char NAME_VALUE_SEPARATOR = '=';

    private ShareTokenLogMasker() {
    }

    /**
     * 원문 경로에서 {@code shared-plans} 세그먼트 뒤 첫 세그먼트를 {@code ***} 로 바꾼다. 나머지 요소는 원문 그대로 잇는다.
     *
     * <p>빈 세그먼트({@code //})는 {@link PathContainer} 가 요소로 만들지 않고, 매개변수뿐인 세그먼트({@code ;a=b})는 라우트의
     * {@code {token}} 이 받지 않으므로 둘 다 건너뛰고 그 뒤 세그먼트를 가린다. 가릴 세그먼트가 없으면 그대로 둔다.
     */
    public static String maskPath(String rawPath) {
        if (rawPath == null) {
            return null;
        }

        try {
            StringBuilder masked = new StringBuilder(rawPath.length());
            boolean tokenPending = false;
            for (Element element : PathContainer.parsePath(rawPath).elements()) {
                if (!(element instanceof PathSegment segment)) {
                    masked.append(element.value());
                    continue;
                }

                boolean isToken = tokenPending && !segment.valueToMatch().isEmpty();
                masked.append(isToken ? MASKED : segment.value());
                if (isToken) {
                    tokenPending = false;
                }
                if (SHARED_PLAN_SEGMENT.equalsIgnoreCase(segment.valueToMatch())) {
                    tokenPending = true;
                }
            }
            return masked.toString();
        } catch (RuntimeException unparsable) {
            // 깨진 퍼센트 인코딩(IllegalArgumentException) 등 — 어느 세그먼트가 토큰인지 모르니 원문을 통째로 남기지 않는다.
            return UNPARSABLE_PATH;
        }
    }

    /**
     * 쿼리스트링에서 디코딩한 이름이 {@code token}(대소문자 무시)인 파라미터의 값을 {@code ***} 로 바꾼다.
     * 이름은 Spring 이 쿼리 파라미터를 읽는 방식({@link URLDecoder})으로 디코딩한다 — {@code %74oken=} 도 {@code token} 이다.
     */
    public static String maskQuery(String query) {
        if (query == null || query.isEmpty()) {
            return query;
        }

        String[] parameters = query.split(QUERY_PARAMETER_SEPARATOR, -1);
        for (int index = 0; index < parameters.length; index++) {
            int separatorAt = parameters[index].indexOf(NAME_VALUE_SEPARATOR);
            if (separatorAt >= 0 && isTokenParameterName(parameters[index].substring(0, separatorAt))) {
                parameters[index] = parameters[index].substring(0, separatorAt + 1) + MASKED;
            }
        }
        return String.join(QUERY_PARAMETER_SEPARATOR, parameters);
    }

    /** {@code scheme://authority} 는 그대로 두고 경로·쿼리를 {@link #maskPath}·{@link #maskQuery} 로 가린다. */
    public static String maskUri(URI uri) {
        if (uri == null) {
            return null;
        }
        if (uri.isOpaque()) {
            // HTTP 요청 URI 는 opaque 일 수 없다. 모양을 모르는 원문은 남기지 않는다.
            return UNPARSABLE_PATH;
        }

        StringBuilder masked = new StringBuilder();
        if (uri.getScheme() != null) {
            masked.append(uri.getScheme()).append(':');
        }
        if (uri.getRawAuthority() != null) {
            masked.append("//").append(uri.getRawAuthority());
        }
        masked.append(maskPath(uri.getRawPath()));
        if (uri.getRawQuery() != null) {
            masked.append('?').append(maskQuery(uri.getRawQuery()));
        }
        return masked.toString();
    }

    private static boolean isTokenParameterName(String rawName) {
        try {
            return TOKEN_QUERY_PARAMETER.equalsIgnoreCase(URLDecoder.decode(rawName, StandardCharsets.UTF_8));
        } catch (IllegalArgumentException undecodable) {
            // 읽지 못한 이름이 token 일 수도 있다. 값을 가리는 쪽이 무해하다.
            return true;
        }
    }
}
