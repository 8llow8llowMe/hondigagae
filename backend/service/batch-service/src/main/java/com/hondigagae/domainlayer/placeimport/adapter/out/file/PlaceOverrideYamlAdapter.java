package com.hondigagae.domainlayer.placeimport.adapter.out.file;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLParser;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.PlaceOverrideCatalogPort;
import com.hondigagae.domainlayer.placeimport.domain.model.PlaceOverride;
import com.hondigagae.shared.travel.place.PetAllowanceType;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

/**
 * 장소 보정 파일 리더 (#1434). 파일은 배포물에 든 {@code classpath:place-overrides.yml} 하나다 — 보정은 코드처럼 리뷰를 거쳐 배포로 바뀐다.
 *
 * <p><b>오타를 조용히 넘기지 않는다.</b> 손으로 고치는 YAML 이라 아래를 모두 읽는 순간 실패({@code PLACE_OVERRIDE_INVALID})로 만든다.
 * <ul>
 *   <li>모르는 칸 이름({@code indor}) — 무시하면 보정이 조용히 빠진다</li>
 *   <li>모르는 enum 값({@code UNKNWON}) · 같은 칸 두 번 · 같은 placeId 두 번 · YAML 별칭({@code *이름})</li>
 *   <li>빈 {@code reason} · {@code evidence}, 바꿀 칸 없음 — 규칙은 {@link PlaceOverride}</li>
 * </ul>
 * 실제 파일은 {@code PlaceOverrideYamlAdapterTest} 가 CI 에서 읽어 본다.
 *
 * <p>스텝이 돌 때마다 읽는다(기동 시점이 아니다). 파일이 깨져도 보정 스텝만 실패하고, 같은 프로세스의 다른 잡(혼잡도 · 올레)과 스케줄러는 산다.
 */
@Slf4j
@Component
public class PlaceOverrideYamlAdapter implements PlaceOverrideCatalogPort {

    public static final String RESOURCE_PATH = "place-overrides.yml";

    private static final ObjectMapper YAML = YAMLMapper.builder()
        .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
        .build();

    private final Resource resource;

    public PlaceOverrideYamlAdapter() {
        this(new ClassPathResource(RESOURCE_PATH));
    }

    /** 테스트가 다른 내용을 읽힐 때 쓴다. */
    PlaceOverrideYamlAdapter(Resource resource) {
        this.resource = resource;
    }

    @Override
    public List<PlaceOverride> readOverrides() {
        List<OverrideEntry> entries = parse();
        List<PlaceOverride> overrides = new ArrayList<>(entries.size());
        Set<Long> placeIds = new HashSet<>();
        for (int i = 0; i < entries.size(); i++) {
            OverrideEntry entry = entries.get(i);
            if (entry == null || entry.placeId() == null) {
                throw invalid("overrides[%d]: placeId 가 없다".formatted(i));
            }
            if (!placeIds.add(entry.placeId())) {
                throw invalid("overrides[%d]: placeId=%d 가 두 번 나온다".formatted(i, entry.placeId()));
            }
            overrides.add(new PlaceOverride(entry.placeId(), entry.expectedTitle(), entry.indoor(), entry.outdoor(), entry.petAllowanceType(),
                entry.reason(), entry.evidence()));
        }
        log.info("place overrides read. resource={}, entries={}", resource.getDescription(), overrides.size());
        return overrides;
    }

    private List<OverrideEntry> parse() {
        if (!resource.exists()) {
            throw invalid("파일이 없다 — " + resource.getDescription());
        }
        try (InputStream input = resource.getInputStream()) {
            byte[] content = input.readAllBytes();
            rejectAliases(content);
            OverrideFile file = YAML.readValue(content, OverrideFile.class);
            return file == null || file.overrides() == null ? List.of() : file.overrides();
        } catch (IOException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.PLACE_OVERRIDE_INVALID, exception,
                resource.getDescription() + " — " + exception.getMessage());
        }
    }

    /**
     * YAML 별칭({@code *이름})을 막는다. Jackson 은 별칭을 가리키는 내용이 아니라 <b>앵커 이름 문자열</b>로 읽어서,
     * {@code reason: *daisoReason} 이 오류 없이 {@code "daisoReason"} 이 된다 — 근거가 조용히 사라진다.
     */
    private void rejectAliases(byte[] content) throws IOException {
        try (JsonParser parser = YAML.getFactory().createParser(content)) {
            while (parser.nextToken() != null) {
                if (parser instanceof YAMLParser yamlParser && yamlParser.isCurrentAlias()) {
                    throw invalid("YAML 별칭(*%s)은 쓰지 않는다 — 내용을 그대로 적는다 (line %d)".formatted(
                        parser.getText(), parser.currentLocation().getLineNr()));
                }
            }
        }
    }

    private static PlaceImportException invalid(String detail) {
        return new PlaceImportException(PlaceImportErrorCode.PLACE_OVERRIDE_INVALID, detail);
    }

    /** 파일 모양. 최상위는 {@code overrides} 목록 하나다. */
    private record OverrideFile(List<OverrideEntry> overrides) {
    }

    /** 항목 모양. 칸 이름이 곧 파일의 키다 — 바꾸면 파일과 문서({@code services/batch-service.md})도 함께 바꾼다. */
    private record OverrideEntry(
        Long placeId, String expectedTitle, Boolean indoor, Boolean outdoor, PetAllowanceType petAllowanceType, String reason, List<String> evidence
    ) {
    }
}
