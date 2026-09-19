package com.hondigagae.domainlayer.plan.adapter.in.web.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.hondigagae.domainlayer.plan.domain.enums.PlanBriefingWalkTimesUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.enums.PlanBriefingWarningUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.enums.PlanDayWeatherUnavailableReason;
import com.hondigagae.domainlayer.plan.domain.enums.PlanItemWalkSafetyUnavailableReason;
import io.swagger.v3.oas.annotations.media.Schema;
import java.lang.reflect.Field;
import java.lang.reflect.RecordComponent;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;

/**
 * 응답 DTO 의 {@code @Schema(allowableValues = ...)} 가 대응 enum 과 같은 값 집합인지 대조한다 (#756).
 *
 * <p><b>허용값 목록은 손으로 복사한 사본이다.</b> enum 에 사유를 하나 더해도 사본은 그대로 남고,
 * 컴파일도 기존 테스트도 전부 통과한다 — 어긋났다는 사실을 아무것도 말해 주지 않는다. 그 다음에
 * 일어나는 일은 정해져 있다. 프론트는 Swagger 의 허용값만 보고 {@code switch} 를 짜고, 나중에
 * 추가된 사유는 {@code default} 로 떨어져 화면에 <b>사유 없는 빈 칸</b>이 뜬다. 그것은
 * {@link PlanItemWalkSafetyUnavailableReason} 의 javadoc 이 "사유 없는 빈 배지" 라고 이름 붙여
 * 직접 경계하는 실패 모양이고, 문서로 경계해 봐야 사본이 갈라지는 것을 막지는 못한다. 그래서
 * 대조를 테스트로 세운다.
 *
 * <p><b>순서는 비교하지 않고 집합으로만 비교한다.</b> 이 저장소의 사유 나열 순서는 DTO 마다 뜻이
 * 다르기 때문이다. {@code PlanDayWeatherItem} 은 enum 선언 순서 그대로지만,
 * {@code PlanItemWalkSafetyItem} 의 설명 문장은 <b>판정 순서</b>({@code PAST_DATE} 가 먼저)로 적혀
 * 있고 그것은 enum 선언 순서({@code NO_START_TIME} 이 먼저)와 다르다. 순서까지 강제하면 둘 중
 * 하나를 의미 없이 바꿔야 한다. 계약이 말해야 하는 것은 <b>무엇이 허용값인가</b>뿐이다.
 *
 * <p><b>{@code @Schema} 는 record component 가 아니라 accessor 에서 읽는다.</b> swagger 의
 * {@code @Target} 이 {@code FIELD · METHOD · PARAMETER · TYPE · ANNOTATION_TYPE} 뿐이고
 * {@code RECORD_COMPONENT} 를 포함하지 않아, record component 선언에 붙인 {@code @Schema} 는
 * 필드 · accessor · 생성자 파라미터로만 전파되고 {@link RecordComponent#getAnnotation} 은 null 을
 * 준다 (swagger-annotations-jakarta 2.2.x 에서 실측). 이름은 record component 에서 얻고 어노테이션만
 * accessor 에서 읽는다 — 앞으로 {@code RECORD_COMPONENT} 가 {@code @Target} 에 추가되더라도
 * 그대로 동작하도록 component 를 먼저 본다.
 *
 * <p><b>스캔의 전제 둘.</b> 지금은 무해하지만 계약이 그쪽으로 옮겨 가면 검사망이 조용히 비므로 적어 둔다.
 * <ul>
 *   <li><b>구체 타입만 잡힌다.</b> {@code ClassPathScanningCandidateComponentProvider} 가
 *       {@code isIndependent() && isConcrete()} 로 걸러서, 인터페이스 · 추상 클래스 · 비static 내부
 *       클래스는 include 필터를 전부 통과시켜도 들어오지 않는다. 응답 계약을 sealed interface 로
 *       표현하기 시작하면 그 타입의 {@code @Schema} 는 대조되지 않는다</li>
 *   <li><b>{@code @ArraySchema} 로 감싼 것은 보지 않는다.</b> 사유 코드를 배열로 내리면서
 *       {@code @ArraySchema(schema = @Schema(allowableValues = ...))} 를 쓰면 {@code @Schema} 가
 *       필드 · accessor 에 직접 붙지 않아 수집되지 않는다. 사유 코드는 record component 에
 *       {@code @Schema} 를 직접 붙인다</li>
 * </ul>
 */
@DisplayName("Swagger allowableValues ↔ 사유 코드 enum 대조")
class SchemaAllowableValuesContractTest {

    private static final String DTO_PACKAGE = "com.hondigagae.domainlayer.plan.adapter.in.web.dto";
    private static final String ENUM_PACKAGE = "com.hondigagae.domainlayer.plan.domain.enums";
    private static final String REASON_ENUM_SUFFIX = "UnavailableReason";

    /**
     * 대조 대상 등록부. 키는 {@code "SimpleClassName#componentName"}.
     *
     * <p>여기에 없는 {@code allowableValues} 필드는 {@link #allowableValuesFieldsMustBeRegistered()} 가
     * 실패로 잡는다 — 등록을 잊은 새 필드가 조용히 검사망 밖으로 나가지 않게 하는 것이 이 테스트의 핵심이다.
     */
    private static final Map<String, Class<? extends Enum<?>>> REGISTRY = new LinkedHashMap<>();

    static {
        REGISTRY.put("PlanDayWeatherItem#unavailableReasonCode", PlanDayWeatherUnavailableReason.class);
        REGISTRY.put("PlanBriefingResponse#weatherWarningUnavailableReasonCode", PlanBriefingWarningUnavailableReason.class);
        REGISTRY.put("PlanBriefingResponse#walkTimesUnavailableReasonCode", PlanBriefingWalkTimesUnavailableReason.class);
        REGISTRY.put("PlanItemWalkSafetyItem#unavailableReasonCode", PlanItemWalkSafetyUnavailableReason.class);
    }

    /** 스캔으로 찾은 실제 선언: {@code "SimpleClassName#componentName"} → {@code allowableValues} 집합. */
    private static final Map<String, Set<String>> DECLARED = scanDeclaredAllowableValues();

    @Test
    @DisplayName("allowableValues 를 쓰는 필드는 모두 REGISTRY 에 등록돼 있다")
    void allowableValuesFieldsMustBeRegistered() {
        List<String> unregistered = DECLARED.keySet().stream()
            .filter(key -> !REGISTRY.containsKey(key))
            .toList();

        assertThat(unregistered)
            .as("""
                새 사유 코드 필드를 추가했으면 이 테스트의 REGISTRY 에도 등록하라 \
                (키는 "SimpleClassName#componentName", 값은 대응 enum 클래스). \
                등록하지 않으면 그 필드의 allowableValues 는 enum 과 대조되지 않고 조용히 검사망 밖으로 나간다. \
                미등록 필드: %s""".formatted(unregistered))
            .isEmpty();
    }

    @Test
    @DisplayName("allowableValues 집합과 enum values() 이름 집합이 같다")
    void allowableValuesMustMatchEnumConstants() {
        List<String> mismatches = new ArrayList<>();

        REGISTRY.forEach((key, enumType) -> {
            Set<String> declaredValues = DECLARED.get(key);
            if (declaredValues == null) {
                // 필드가 아예 없는 경우는 registryMustNotPointAtMissingFields() 가 맡는다 — 여기서 겹쳐 실패시키지 않는다.
                return;
            }
            Set<String> enumNames = enumConstantNames(enumType);

            Set<String> missingInSwagger = new TreeSet<>(enumNames);
            missingInSwagger.removeAll(declaredValues);
            Set<String> absentFromEnum = new TreeSet<>(declaredValues);
            absentFromEnum.removeAll(enumNames);

            if (!missingInSwagger.isEmpty() || !absentFromEnum.isEmpty()) {
                mismatches.add("%s ↔ %s | enum 에만 있어 allowableValues 에 빠진 값: %s | allowableValues 에만 있어 enum 에 없는 값: %s"
                    .formatted(key, enumType.getSimpleName(), missingInSwagger, absentFromEnum));
            }
        });

        assertThat(mismatches)
            .as("""
                Swagger 의 allowableValues 가 대응 enum 과 갈라졌다. enum 을 정본으로 보고 @Schema 의 목록을 맞춰라 \
                (순서는 보지 않는다 — 값 집합만 같으면 된다). 불일치: %s""".formatted(mismatches))
            .isEmpty();
    }

    /**
     * 위 셋은 <b>사본이 갈라지는 것</b>만 막는다. <b>사본을 아예 만들지 않는 것</b>은 막지 못한다 —
     * {@code allowableValues} 없이 설명 문장에만 사유를 나열하면 세 테스트의 입력({@link #DECLARED} ·
     * {@link #REGISTRY})에 아무것도 남기지 않아 전부 초록이다.
     *
     * <p>가정이 아니라 <b>이 저장소에서 실제로 일어난 일</b>이다. {@code PlanItemWalkSafetyItem} 이
     * #756 직전까지 정확히 그 상태였고, 그래서 Swagger 가 그 자리의 허용값을 내주지 못했다.
     *
     * <p>그래서 대조를 <b>반대 방향으로도</b> 건다 — 사유 코드 enum 쪽에서 출발해 모두 등록돼 있는지
     * 본다. 접미사 {@code *UnavailableReason} 을 앵커로 쓰는 이유는, 같은 패키지의 {@code PlanStatus} ·
     * {@code PackingItemSource} 처럼 <b>String 사유 코드가 아니라 metadata/enum 으로 내려가는</b> enum 은
     * 애초에 {@code allowableValues} 를 쓰지 않아 오탐이 되기 때문이다.
     */
    @Test
    @DisplayName("사유 코드 enum 은 모두 어딘가의 allowableValues 로 내려간다 — 사본을 안 만드는 것도 막는다")
    void everyUnavailableReasonEnumMustBeCovered() {
        Set<Class<?>> registered = Set.copyOf(REGISTRY.values());

        List<String> orphans = scanUnavailableReasonEnums().stream()
            .filter(enumType -> !registered.contains(enumType))
            .map(Class::getSimpleName)
            .sorted()
            .toList();

        assertThat(orphans)
            .as("""
                사유 코드 enum 을 만들었으면 응답 필드에 @Schema(allowableValues = ...) 로 내리고 \
                이 테스트의 REGISTRY 에 등록하라. 설명 문장에 사유를 나열하는 것만으로는 Swagger 가 \
                허용값 목록을 만들지 못해, 프론트가 switch 를 세우지 못하고 새 사유가 default 로 떨어진다 \
                (#756 직전의 PlanItemWalkSafetyItem 이 그 상태였다). \
                내릴 자리가 없는 enum 이라면 이름을 *UnavailableReason 으로 두지 마라. \
                어디에도 등록되지 않은 사유 코드 enum: %s""".formatted(orphans))
            .isEmpty();
    }

    @Test
    @DisplayName("REGISTRY 에 실제로 없는 필드가 남아 있지 않다")
    void registryMustNotPointAtMissingFields() {
        List<String> ghosts = REGISTRY.keySet().stream()
            .filter(key -> !DECLARED.containsKey(key))
            .toList();

        assertThat(ghosts)
            .as("""
                REGISTRY 에 등록됐지만 allowableValues 를 가진 실제 필드가 없다. 필드 이름이나 DTO 이름이 바뀌었는데 \
                등록부만 남았거나, @Schema 에서 allowableValues 가 지워진 것이다. 등록부를 현재 이름으로 고치거나 항목을 지워라. \
                유령 등록: %s""".formatted(ghosts))
            .isEmpty();
    }

    /**
     * 사유 코드 enum 목록. {@link #DTO_PACKAGE} 스캔과 같은 방식이라 같은 전제를 공유한다
     * (구체 타입만 잡힌다 — enum 은 항상 구체라 문제되지 않는다).
     */
    private static List<Class<?>> scanUnavailableReasonEnums() {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter((metadataReader, metadataReaderFactory) -> true);

        // 타입 증인이 필요하다 — Stream<Class<?>>.toList() 는 캡처 때문에 List<Class<CAP>> 로 추론된다.
        return scanner.findCandidateComponents(ENUM_PACKAGE).stream()
            .<Class<?>>map(definition -> loadClass(definition.getBeanClassName()))
            .filter(Class::isEnum)
            .filter(type -> type.getSimpleName().endsWith(REASON_ENUM_SUFFIX))
            .toList();
    }

    private static Set<String> enumConstantNames(Class<? extends Enum<?>> enumType) {
        return Arrays.stream(enumType.getEnumConstants())
            .map(Enum::name)
            .collect(Collectors.toCollection(TreeSet::new));
    }

    /**
     * DTO 패키지 전체를 훑어 {@code allowableValues} 가 비어 있지 않은 선언을 모은다.
     *
     * <p>record 는 {@code @Component} 가 아니라 기본 필터로는 잡히지 않는다 — 그래서
     * {@code useDefaultFilters=false} 로 만들고 전부 통과시키는 include 필터를 건다.
     */
    private static Map<String, Set<String>> scanDeclaredAllowableValues() {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter((metadataReader, metadataReaderFactory) -> true);

        Map<String, Set<String>> declared = new TreeMap<>();
        for (BeanDefinition definition : scanner.findCandidateComponents(DTO_PACKAGE)) {
            collectFrom(loadClass(definition.getBeanClassName()), declared);
        }
        return declared;
    }

    private static void collectFrom(Class<?> dtoType, Map<String, Set<String>> declared) {
        if (dtoType.isRecord()) {
            for (RecordComponent component : dtoType.getRecordComponents()) {
                put(declared, dtoType, component.getName(), schemaOf(component));
            }
            return;
        }
        for (Field field : dtoType.getDeclaredFields()) {
            if (!field.isSynthetic()) {
                put(declared, dtoType, field.getName(), field.getAnnotation(Schema.class));
            }
        }
    }

    private static Schema schemaOf(RecordComponent component) {
        Schema onComponent = component.getAnnotation(Schema.class);
        return onComponent != null ? onComponent : component.getAccessor().getAnnotation(Schema.class);
    }

    private static void put(Map<String, Set<String>> declared, Class<?> dtoType, String name, Schema schema) {
        if (schema == null || schema.allowableValues().length == 0) {
            return;
        }
        String key = dtoType.getSimpleName() + "#" + name;
        Set<String> values = new TreeSet<>(Arrays.asList(schema.allowableValues()));
        Set<String> previous = declared.put(key, values);
        if (previous != null && !previous.equals(values)) {
            // 단순 이름이 같은 DTO 가 두 하위 패키지에 있으면 키가 겹쳐 한쪽 검사가 조용히 사라진다.
            // 고칠 것은 DTO 이름이 아니라 이 테스트의 키 생성 방식이다 — 응답 DTO 를 개명하면
            // Swagger 스키마 이름이 바뀌어 API 계약이 흔들린다.
            throw new IllegalStateException(
                "키가 겹치는 DTO 가 있다. 이 테스트의 키 생성(getSimpleName)을 바깥 클래스까지 포함한 이름으로 바꿔라"
                    + " — DTO 를 개명하지 마라. 겹친 키: " + key + " (기존 값 " + previous + " / 새 값 " + values + ")");
        }
    }

    private static Class<?> loadClass(String className) {
        try {
            return Class.forName(className);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("DTO 클래스를 로드하지 못했다: " + className, e);
        }
    }
}
