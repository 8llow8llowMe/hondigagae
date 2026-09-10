package com.hondigagae.domainlayer.walkcourseimport.adapter.out.client;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportErrorCode;
import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportException;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.OlleCourseSourcePort;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseCsvFileQueryResult;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseSourceQueryResult;
import com.hondigagae.global.properties.OlleCourseProperties;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.ByteBuffer;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
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
 * 공공데이터포털 제주올레 CSV 원천 어댑터.
 *
 * <p>상세 페이지({@code /data/15043496/fileData.do})가 서버 렌더링이고, 그 안
 * {@code <script type="application/ld+json">} 블록에 schema.org {@code DataDownload} 가
 * 들어 있다. 거기 {@code contentUrl} 이 로그인·인증키 없이 200 으로 CSV 를 주는 주소다.
 *
 * <p>그래도 공개된 오픈 API 가 아니다. 페이지가 바뀌면 끊기므로 실패는
 * {@code SOURCE_PAGE_*} 로 분명히 드러내고, 그때는 로컬 우회 파일로 물러난다.
 *
 * <p>올레 CSV 는 수십 행이라 메모리에 올려도 되지만, 문화정보원과 같은 스트리밍 경로를
 * 쓴다 - 포털이 점검 HTML 을 주면 그것도 파일로 받은 뒤 첫 줄에서 거른다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataGoKrOlleCourseSourceAdapter implements OlleCourseSourcePort {

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
    static final String CSV_HEADER_MARKER = "코스별";
    private static final String BOM = "\uFEFF";
    private static final String USER_AGENT = "hondigagae-batch/1.0 (+https://github.com/8llow8llowMe/hondigagae)";
    private static final int HEADER_PROBE_BYTES = 4096;

    private final WebClient openApiWebClient;
    private final OlleCourseProperties properties;
    private final CircuitBreakerRegistry circuitBreakerRegistry;

    @Override
    public OlleCourseSourceQueryResult resolveLatest() {
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
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_CIRCUIT_OPEN, exception);
        } catch (RuntimeException exception) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_FAILED, exception, pageUri);
        }

        OlleCourseSourceQueryResult source = parseSource(html);
        log.info("olle course source resolved fileId={} fileDetailSn={}", source.fileId(), source.fileDetailSn());
        return source;
    }

    @Override
    public OlleCourseCsvFileQueryResult download(OlleCourseSourceQueryResult source) {
        Path tempFile = createTempFile();
        try {
            HttpHeaders responseHeaders = transfer(source, tempFile);
            long contentLength = Files.size(tempFile);
            validate(tempFile, contentLength, declaredContentLength(responseHeaders));

            String fileName = parseFileName(responseHeaders.getFirst(HttpHeaders.CONTENT_DISPOSITION));
            log.info("olle course csv downloaded fileId={} fileName={} bytes={} path={}",
                source.fileId(), fileName, contentLength, tempFile);
            return new OlleCourseCsvFileQueryResult(tempFile, fileName, contentLength);
        } catch (CallNotPermittedException exception) {
            deleteQuietly(tempFile);
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_CIRCUIT_OPEN, exception);
        } catch (WalkCourseImportException exception) {
            deleteQuietly(tempFile);
            throw exception;
        } catch (IOException | RuntimeException exception) {
            deleteQuietly(tempFile);
            throw new WalkCourseImportException(WalkCourseImportErrorCode.DOWNLOAD_FAILED, exception, source.contentUrl());
        }
    }

    private HttpHeaders transfer(OlleCourseSourceQueryResult source, Path tempFile) {
        return circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME).executeSupplier(() -> {
            ResponseEntity<Flux<DataBuffer>> response = openApiWebClient.get()
                .uri(source.contentUrl())
                .header(HttpHeaders.REFERER, detailPageUri())
                .header(HttpHeaders.USER_AGENT, USER_AGENT)
                .retrieve()
                .toEntityFlux(DataBuffer.class)
                .block(Duration.ofMillis(properties.readTimeoutMs()));

            Flux<DataBuffer> body = response == null ? null : response.getBody();
            if (body == null) {
                throw new WalkCourseImportException(WalkCourseImportErrorCode.DOWNLOAD_FAILED, "빈 응답");
            }
            DataBufferUtils.write(body, tempFile, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)
                .block(Duration.ofMillis(properties.readTimeoutMs()));
            return response.getHeaders();
        });
    }

    private static Long declaredContentLength(HttpHeaders headers) {
        long declared = headers.getContentLength();
        return declared < 0 ? null : declared;
    }

    /**
     * 받은 것이 정말 올레 CSV 인지 최소한만 확인한다.
     *
     * <p>포털이 점검 중이면 200 으로 HTML 안내 페이지를 준다. 첫 줄 {@code 코스별} 이 없으면
     * 거부한다. 원본이 CP949 일 수 있어 UTF-8 과 MS949 둘 다 본다.
     *
     * <p>헤더 {@code Content-Length} 가 있으면 디스크 바이트 수와 같아야 한다. 잘린 판본이
     * 스냅샷으로 굳으면 다음 실행부터 같은 {@code atchFileId} 로 영구 SKIP 된다.
     */
    void validate(Path tempFile, long contentLength, Long declaredContentLength) throws IOException {
        if (declaredContentLength != null && declaredContentLength != contentLength) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.DOWNLOAD_INVALID,
                "Content-Length 불일치 expected=%d actual=%d".formatted(declaredContentLength, contentLength));
        }
        if (contentLength < properties.minContentLength()) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.DOWNLOAD_INVALID,
                "%d bytes < %d".formatted(contentLength, properties.minContentLength()));
        }
        if (!headerLooksLikeCsv(tempFile)) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.DOWNLOAD_INVALID,
                "첫 줄에 '%s' 없음".formatted(CSV_HEADER_MARKER));
        }
    }

    static boolean headerLooksLikeCsv(Path tempFile) throws IOException {
        byte[] bytes = Files.readAllBytes(tempFile);
        byte[] probe = bytes.length > HEADER_PROBE_BYTES ? java.util.Arrays.copyOf(bytes, HEADER_PROBE_BYTES) : bytes;
        return firstLineContains(probe, StandardCharsets.UTF_8) || firstLineContains(probe, Charset.forName("MS949"));
    }

    private static boolean firstLineContains(byte[] bytes, Charset charset) {
        try {
            CharsetDecoder decoder = charset.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);
            String text = decoder.decode(ByteBuffer.wrap(bytes)).toString();
            String firstLine = text.split("\\R", 2)[0];
            if (firstLine.startsWith(BOM)) {
                firstLine = firstLine.substring(1);
            }
            return firstLine.contains(CSV_HEADER_MARKER);
        } catch (java.nio.charset.CharacterCodingException exception) {
            return false;
        }
    }

    private Path createTempFile() {
        try {
            Path directory = properties.downloadDir() == null
                ? Path.of(System.getProperty("java.io.tmpdir"))
                : Path.of(properties.downloadDir());
            Files.createDirectories(directory);
            return Files.createTempFile(directory, "olle_course_", ".csv");
        } catch (IOException exception) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.DOWNLOAD_FAILED, exception, "임시 파일 생성");
        }
    }

    private void deleteQuietly(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException exception) {
            log.warn("olle course temp file delete failed path={} reason={}", path, exception.getMessage());
        }
    }

    private String detailPageUri() {
        return "%s/data/%s/fileData.do".formatted(properties.baseUrl(), properties.datasetId());
    }

    static OlleCourseSourceQueryResult parseSource(String html) {
        if (html == null || html.isBlank()) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID, "빈 페이지");
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
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID,
                "DataDownload contentUrl 없음 (jsonLdBlocks=%d)".formatted(downloads.size()));
        }

        String contentUrl = text(chosen, "contentUrl");
        String fileId = firstGroup(ATCH_FILE_ID_PATTERN, contentUrl);
        if (fileId == null) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID, "atchFileId 없음");
        }
        return new OlleCourseSourceQueryResult(fileId, firstGroup(FILE_DETAIL_SN_PATTERN, contentUrl), contentUrl);
    }

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
            log.debug("olle course json-ld block skipped reason={}", exception.getOriginalMessage());
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
