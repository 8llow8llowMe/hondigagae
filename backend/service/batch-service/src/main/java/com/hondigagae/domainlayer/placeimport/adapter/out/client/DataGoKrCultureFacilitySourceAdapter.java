package com.hondigagae.domainlayer.placeimport.adapter.out.client;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportErrorCode;
import com.hondigagae.domainlayer.placeimport.application.exception.PlaceImportException;
import com.hondigagae.domainlayer.placeimport.application.port.out.CultureFacilitySourcePort;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.CultureFacilityCsvFileQueryResult;
import com.hondigagae.domainlayer.placeimport.application.port.out.query.CultureFacilitySourceQueryResult;
import com.hondigagae.global.properties.CultureFacilityProperties;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.io.BufferedReader;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

/**
 * 공공데이터포털 문화정보원 CSV 원천 어댑터 (#379).
 *
 * <p><b>왜 긁을 수 있나.</b> 상세 페이지({@code /data/15111389/fileData.do})가 서버 렌더링이고,
 * 그 안 {@code <script type="application/ld+json">} 블록에 schema.org {@code DataDownload} 가
 * 들어 있다. 거기 {@code contentUrl} 이 로그인·인증키 없이 200 으로 CSV 를 주는 주소다.
 * 화면 DOM 구조가 아니라 <b>구조화 메타데이터</b>를 읽으므로 개편에 비교적 덜 흔들린다.
 *
 * <p><b>주의</b>: 그래도 공개된 오픈 API 가 아니다. 페이지가 바뀌면 끊기므로 실패는
 * {@code CULTURE_SOURCE_PAGE_*} 로 분명히 드러내고, 그때는 로컬 우회 파일로 물러난다
 * ({@code CultureFacilitySourceProcessor}).
 *
 * <p><b>스트리밍</b>: 30MB 를 메모리에 올리지 않는다. {@code toEntityFlux} 로 헤더와 본문을 함께
 * 받아 임시 파일로 흘린다 - {@code openApiWebClient} 의 4MB {@code maxInMemorySize} 는 집계
 * 디코더에만 걸리고, 10초 {@code responseTimeout} 은 읽기 사이 무활동 상한이라 긴 전송에는
 * 걸리지 않는다. 컨테이너의 {@code /app/data} 는 읽기 전용이라 거기에 쓸 수 없다.
 * 헤더를 함께 받는 이유가 하나 더 있다 - 다 받은 뒤 {@code Content-Length} 와 디스크에 쓰인
 * 바이트 수를 대조해 <b>중간에 끊긴 전송</b>을 걸러낸다({@link #validate}).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataGoKrCultureFacilitySourceAdapter implements CultureFacilitySourcePort {

    /** 서킷 인스턴스명. 공공데이터포털 파일 서버 전용이다. */
    public static final String CIRCUIT_NAME = "datagokr";

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private static final Pattern JSON_LD_PATTERN = Pattern.compile(
        "<script[^>]*type\\s*=\\s*[\"']application/ld\\+json[\"'][^>]*>(.*?)</script>",
        Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern ATCH_FILE_ID_PATTERN = Pattern.compile("[?&]atchFileId=([^&#]+)");
    private static final Pattern FILE_DETAIL_SN_PATTERN = Pattern.compile("[?&]fileDetailSn=([^&#]+)");
    private static final Pattern FILENAME_EXT_PATTERN =
        Pattern.compile("filename\\*\\s*=\\s*([^']*)'([^']*)'([^;]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern FILENAME_PATTERN =
        Pattern.compile("filename\\s*=\\s*\"?([^\";]+)\"?", Pattern.CASE_INSENSITIVE);

    private static final String DOWNLOAD_URL_MARKER = "fileDownload.do";
    private static final String TYPE_DATA_DOWNLOAD = "DataDownload";
    /** 첫 줄에 이 컬럼이 없으면 CSV 가 아니라 오류 페이지를 받은 것이다. */
    private static final String CSV_HEADER_MARKER = "시설명";
    private static final String BOM = "\uFEFF";
    // reactor-netty 는 User-Agent 를 보내지 않는다. 포털이 빈 UA 를 막을지는 확인된 바 없지만 붙이는 비용이 없다.
    private static final String USER_AGENT = "hondigagae-batch/1.0 (+https://github.com/8llow8llowMe/hondigagae)";

    private final WebClient openApiWebClient;
    private final CultureFacilityProperties properties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    @Override
    public CultureFacilitySourceQueryResult resolveLatest() {
        String pageUri = detailPageUri();
        String html;
        try {
            html = circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME).executeSupplier(() ->
                openApiWebClient.get()
                    .uri(pageUri)
                    .header(HttpHeaders.USER_AGENT, USER_AGENT)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(Duration.ofMillis(properties.readTimeoutMs()))
            );
        } catch (CallNotPermittedException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_SOURCE_CIRCUIT_OPEN, exception);
        } catch (RuntimeException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_SOURCE_PAGE_FAILED, exception, pageUri);
        }

        // 파싱은 서킷 밖이다. 페이지 구조가 바뀐 것은 원천 장애가 아니라 우리 파서의 문제라
        // 서킷을 열 일이 아니다 (application.yml 의 "서킷은 전송 호출만 감싼다" 방침).
        CultureFacilitySourceQueryResult source = parseSource(html);
        log.info("culture facility source resolved fileId={} fileDetailSn={}", source.fileId(), source.fileDetailSn());
        return source;
    }

    @Override
    public CultureFacilityCsvFileQueryResult download(CultureFacilitySourceQueryResult source) {
        Path tempFile = createTempFile();
        try {
            HttpHeaders responseHeaders = transfer(source, tempFile);
            long contentLength = Files.size(tempFile);
            validate(tempFile, contentLength, declaredContentLength(responseHeaders));

            String fileName = parseFileName(responseHeaders.getFirst(HttpHeaders.CONTENT_DISPOSITION));
            log.info("culture facility csv downloaded fileId={} fileName={} bytes={} path={}",
                source.fileId(), fileName, contentLength, tempFile);
            return new CultureFacilityCsvFileQueryResult(tempFile, fileName, contentLength);
        } catch (CallNotPermittedException exception) {
            deleteQuietly(tempFile);
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_SOURCE_CIRCUIT_OPEN, exception);
        } catch (PlaceImportException exception) {
            deleteQuietly(tempFile);
            throw exception;
        } catch (IOException | RuntimeException exception) {
            deleteQuietly(tempFile);
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_DOWNLOAD_FAILED, exception, source.contentUrl());
        }
    }

    /** 헤더와 본문을 함께 받아 본문을 파일로 흘리고, 응답 헤더를 돌려준다 (Content-Length·Content-Disposition 용). */
    private HttpHeaders transfer(CultureFacilitySourceQueryResult source, Path tempFile) {
        return circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME).executeSupplier(() -> {
            ResponseEntity<Flux<DataBuffer>> response = openApiWebClient.get()
                .uri(source.contentUrl())
                // 화면이 쓰는 경로라 상세 페이지를 Referer 로 붙여 둔다.
                .header(HttpHeaders.REFERER, detailPageUri())
                .header(HttpHeaders.USER_AGENT, USER_AGENT)
                .retrieve()
                .toEntityFlux(DataBuffer.class)
                .block(Duration.ofMillis(properties.readTimeoutMs()));

            Flux<DataBuffer> body = response == null ? null : response.getBody();
            if (body == null) {
                throw new PlaceImportException(PlaceImportErrorCode.CULTURE_DOWNLOAD_FAILED, "빈 응답");
            }
            DataBufferUtils.write(body, tempFile, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)
                .block(Duration.ofMillis(properties.readTimeoutMs()));
            return response.getHeaders();
        });
    }

    /** 서버가 알려 준 본문 크기. 청크 전송이면 헤더가 없어 -1 이고, 그때는 대조할 것이 없으므로 null 이다. */
    private static Long declaredContentLength(HttpHeaders headers) {
        long declared = headers.getContentLength();
        return declared < 0 ? null : declared;
    }

    /**
     * 받은 것이 정말 CSV 인지 최소한만 확인한다.
     *
     * <p>포털이 점검 중이면 200 으로 HTML 안내 페이지를 준다. 그것을 그대로 파서에 넘기면
     * "컬럼 없음"으로 죽거나 0건 적재가 되고, 0건 적재는 delist 급감 가드까지 흔든다.
     *
     * <p><b>먼저 {@code Content-Length} 를 대조한다.</b> 전송이 중간에 끊겨 30MB 중 5MB 만 받아도
     * 스트리밍은 정상 종료로 보이고, 잘린 본문은 1MB 하한도 첫 줄 {@code 시설명} 도 통과한다.
     * 그대로 두면 잘린 판본이 스냅샷으로 굳고 <b>다음 실행부터 같은 {@code atchFileId} 로 영구
     * SKIP</b> 된다 — 사람이 알아채기까지 몇 달이 걸리는 종류의 고장이다.
     *
     * <p>HTTP 없이 임시 파일만으로 검증할 수 있도록 package-private 으로 열어 둔다.
     *
     * @param contentLength         디스크에 실제로 쓰인 바이트 수
     * @param declaredContentLength 응답 헤더가 알려 준 바이트 수. 헤더가 없으면 null (대조하지 않는다)
     */
    void validate(Path tempFile, long contentLength, Long declaredContentLength) throws IOException {
        if (declaredContentLength != null && declaredContentLength != contentLength) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_DOWNLOAD_INVALID,
                "Content-Length 불일치 expected=%d actual=%d".formatted(declaredContentLength, contentLength));
        }
        if (contentLength < properties.minContentLength()) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_DOWNLOAD_INVALID,
                "%d bytes < %d".formatted(contentLength, properties.minContentLength()));
        }
        try (BufferedReader reader = Files.newBufferedReader(tempFile, StandardCharsets.UTF_8)) {
            String firstLine = reader.readLine();
            if (firstLine != null && firstLine.startsWith(BOM)) {
                firstLine = firstLine.substring(1);
            }
            if (firstLine == null || !firstLine.contains(CSV_HEADER_MARKER)) {
                throw new PlaceImportException(PlaceImportErrorCode.CULTURE_DOWNLOAD_INVALID,
                    "첫 줄에 '%s' 없음".formatted(CSV_HEADER_MARKER));
            }
        }
    }

    private Path createTempFile() {
        try {
            Path directory = properties.downloadDir() == null
                ? Path.of(System.getProperty("java.io.tmpdir"))
                : Path.of(properties.downloadDir());
            Files.createDirectories(directory);
            return Files.createTempFile(directory, "pet_culture_", ".csv");
        } catch (IOException exception) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_DOWNLOAD_FAILED, exception, "임시 파일 생성");
        }
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            log.warn("culture facility temp file delete failed path={} reason={}", path, exception.getMessage());
        }
    }

    private String detailPageUri() {
        return "%s/data/%s/fileData.do".formatted(properties.baseUrl(), properties.datasetId());
    }

    /**
     * 상세 페이지의 JSON-LD 에서 CSV 다운로드 주소를 찾는다.
     *
     * <p>HTTP 없이 검증할 수 있도록 static 으로 떼어 둔다. 트리 어디에 있든
     * {@code "@type":"DataDownload"} 객체를 모아 {@code fileDownload.do} 를 가리키는 것을 고르고,
     * 같은 조건이 여럿이면 {@code encodingFormat} 이 CSV 인 쪽을 우선한다.
     */
    static CultureFacilitySourceQueryResult parseSource(String html) {
        if (html == null || html.isBlank()) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_SOURCE_PAGE_INVALID, "빈 페이지");
        }

        List<JsonNode> downloads = new ArrayList<>();
        Matcher blocks = JSON_LD_PATTERN.matcher(html);
        while (blocks.find()) {
            JsonNode tree = readTree(blocks.group(1));
            if (tree != null) {
                collectDataDownloads(tree, downloads);
            }
        }

        JsonNode chosen = null;
        for (JsonNode download : downloads) {
            String contentUrl = text(download, "contentUrl");
            if (contentUrl == null || !contentUrl.contains(DOWNLOAD_URL_MARKER)) {
                continue;
            }
            String encodingFormat = text(download, "encodingFormat");
            if (encodingFormat != null && encodingFormat.toUpperCase().contains("CSV")) {
                chosen = download;
                break;
            }
            if (chosen == null) {
                chosen = download;
            }
        }
        if (chosen == null) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_SOURCE_PAGE_INVALID,
                "DataDownload contentUrl 없음 (jsonLdBlocks=%d)".formatted(downloads.size()));
        }

        String contentUrl = text(chosen, "contentUrl");
        String fileId = firstGroup(ATCH_FILE_ID_PATTERN, contentUrl);
        if (fileId == null) {
            throw new PlaceImportException(PlaceImportErrorCode.CULTURE_SOURCE_PAGE_INVALID, "atchFileId 없음");
        }
        return new CultureFacilitySourceQueryResult(fileId, firstGroup(FILE_DETAIL_SN_PATTERN, contentUrl), contentUrl);
    }

    /**
     * {@code Content-Disposition} 의 파일명. RFC 5987 {@code filename*} 을 우선한다.
     *
     * <p>사람이 어느 판본인지 알아보는 값일 뿐이라 <b>못 읽어도 실패시키지 않는다</b> - null 로
     * 기록하고 넘어간다. 갱신 판정은 {@code atchFileId} 와 바이트 수가 한다.
     *
     * <p>퍼센트 디코딩은 {@code filename*} 에만 건다. plain {@code filename} 은 인코딩을 선언하지
     * 않는 값이라, 이름에 {@code %} 가 들어간 파일을 디코딩하면 없던 글자로 바꿔 버린다.
     */
    static String parseFileName(String contentDisposition) {
        if (contentDisposition == null || contentDisposition.isBlank()) {
            return null;
        }
        Matcher extended = FILENAME_EXT_PATTERN.matcher(contentDisposition);
        if (extended.find()) {
            String charsetName = extended.group(1).isBlank() ? StandardCharsets.UTF_8.name() : extended.group(1).trim();
            String raw = extended.group(3).trim().replace("\"", "");
            return decodeQuietly(raw, charsetName);
        }
        Matcher plain = FILENAME_PATTERN.matcher(contentDisposition);
        return plain.find() ? plain.group(1).trim() : null;
    }

    private static String decodeQuietly(String raw, String charsetName) {
        try {
            return URLDecoder.decode(raw, Charset.forName(charsetName));
        } catch (RuntimeException exception) {
            // 잘못된 퍼센트 인코딩이나 모르는 charset. 파일명은 기록용이라 원문 그대로 둔다.
            return raw;
        }
    }

    private static void collectDataDownloads(JsonNode node, List<JsonNode> collected) {
        if (node.isArray()) {
            node.forEach(child -> collectDataDownloads(child, collected));
            return;
        }
        if (!node.isObject()) {
            return;
        }
        if (TYPE_DATA_DOWNLOAD.equalsIgnoreCase(text(node, "@type"))) {
            collected.add(node);
        }
        node.forEach(child -> collectDataDownloads(child, collected));
    }

    private static JsonNode readTree(String json) {
        try {
            return OBJECT_MAPPER.readTree(json.trim());
        } catch (JsonProcessingException exception) {
            // JSON-LD 블록이 여럿이라 하나가 깨져도 나머지에서 찾을 수 있다.
            log.debug("culture facility json-ld block skipped reason={}", exception.getOriginalMessage());
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || !value.isTextual() ? null : value.asText();
    }

    private static String firstGroup(Pattern pattern, String value) {
        Matcher matcher = pattern.matcher(value);
        return matcher.find() ? matcher.group(1) : null;
    }
}
