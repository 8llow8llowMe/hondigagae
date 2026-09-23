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
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Flux;

/**
 * 공공데이터포털 제주올레 CSV 원천 어댑터.
 *
 * <p>상세 페이지({@code /data/15043496/fileData.do})의 "다운로드" 버튼이 브라우저에서 하는 일을
 * 그대로 따라 한다 (2026-09-23 실측, {@code data-api-analysis.md} "제주올레 파일 다운로드 경로").
 * <ol>
 *   <li>페이지 HTML 에서 {@code fn_fileDataDown(publicDataPk, publicDataDetailPk, atchFileId,
 *       fileDetailSn, publicDataHistSn)} 인자를 읽는다. {@code publicDataDetailPk} 는 {@code uddi:} 로
 *       시작하는 상세 PK 이고, 페이지에 박힌 {@code atchFileId} 인자는 빈 값이다.</li>
 *   <li>그 인자로 {@code POST /tcs/dss/selectFileDataDownload.do} 를 불러 지금 올라와 있는 파일의
 *       {@code atchFileId}·{@code fileDetailSn} 을 받는다.</li>
 *   <li>{@code GET /cmm/cmm/fileDownload.do?atchFileId=…&fileDetailSn=…} 로 CSV 를 받는다.</li>
 * </ol>
 *
 * <p>페이지의 JSON-LD 는 더 읽지 않는다. {@code DataDownload.contentUrl} 이 남아 있기는 하지만
 * 제공기관이 쓴 {@code description} 에 이스케이프 안 된 따옴표가 들어가 블록 전체가 JSON 으로
 * 읽히지 않는다 (#876). 제공기관 설명 문구 하나에 원천이 끊기는 경로라 버튼 경로로 갈아탔다.
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

    static final String DOWNLOAD_TICKET_PATH = "/tcs/dss/selectFileDataDownload.do";
    static final String FILE_DOWNLOAD_PATH = "/cmm/cmm/fileDownload.do";

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private static final String QUOTED_ARG = "\\s*['\"]([^'\"]*)['\"]\\s*";
    /** 다운로드 버튼의 onclick. 인자는 따옴표로 감싼 문자열 다섯 개이고 앞의 넷만 쓴다. */
    private static final Pattern DOWNLOAD_TRIGGER_PATTERN = Pattern.compile(
        "fn_fileDataDown\\(" + QUOTED_ARG + "," + QUOTED_ARG + "," + QUOTED_ARG + "," + QUOTED_ARG + ",");
    private static final Pattern FILENAME_EXT_PATTERN =
        Pattern.compile("filename\\*\\s*=\\s*([^']*)'([^']*)'([^;]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern FILENAME_PATTERN =
        Pattern.compile("filename\\s*=\\s*\"?([^\";]+)\"?", Pattern.CASE_INSENSITIVE);

    /** 버튼이 보내는 값 그대로. 파일데이터 유형 코드다. */
    private static final String FILE_DATA_TYPE_CODE = "PR0051";
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
        String html = fetchText(pageUri, () -> openApiWebClient.get()
            .uri(pageUri)
            .header(HttpHeaders.USER_AGENT, USER_AGENT)
            .retrieve()
            .bodyToMono(String.class)
            .block(Duration.ofMillis(properties.readTimeoutMs())));

        DownloadTrigger trigger = parseDownloadTrigger(html, properties.datasetId());

        String ticketUri = properties.baseUrl() + DOWNLOAD_TICKET_PATH;
        String ticket = fetchText(ticketUri, () -> openApiWebClient.post()
            .uri(ticketUri)
            .header(HttpHeaders.REFERER, pageUri)
            .header(HttpHeaders.USER_AGENT, USER_AGENT)
            .body(BodyInserters.fromFormData(trigger.toFormData()))
            .retrieve()
            .bodyToMono(String.class)
            .block(Duration.ofMillis(properties.readTimeoutMs())));

        OlleCourseSourceQueryResult source = parseDownloadTicket(ticket, properties.baseUrl(), properties.datasetId());
        log.info("olle course source resolved publicDataDetailPk={} fileId={} fileDetailSn={}",
            trigger.publicDataDetailPk(), source.fileId(), source.fileDetailSn());
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

    /** 페이지·다운로드 티켓처럼 본문을 문자열로 받는 단계. 실패는 {@code SOURCE_PAGE_FAILED} 다. */
    private String fetchText(String uri, Supplier<String> call) {
        try {
            return circuitBreakerRegistry.circuitBreaker(CIRCUIT_NAME).executeSupplier(call);
        } catch (CallNotPermittedException exception) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_CIRCUIT_OPEN, exception);
        } catch (RuntimeException exception) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_FAILED, exception, uri);
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

    /**
     * 첫 줄만 떼어 두 인코딩으로 본다.
     *
     * <p>엄격 디코딩(REPORT)이라 멀티바이트 글자 중간에서 자르면 정상 CSV 도 거부된다. 그래서 고정
     * 길이가 아니라 첫 {@code \n} 바이트에서 자른다 — {@code 0x0A} 는 UTF-8 에서도 MS949 에서도
     * 멀티바이트 글자 안에 나오지 않는다. 첫 줄이 {@value #HEADER_PROBE_BYTES} 바이트를 넘으면
     * 헤더가 아니라고 본다.
     */
    static boolean headerLooksLikeCsv(Path tempFile) throws IOException {
        byte[] probe = firstLineBytes(tempFile);
        return firstLineContains(probe, StandardCharsets.UTF_8) || firstLineContains(probe, Charset.forName("MS949"));
    }

    private static byte[] firstLineBytes(Path tempFile) throws IOException {
        byte[] head;
        try (java.io.InputStream in = Files.newInputStream(tempFile)) {
            head = in.readNBytes(HEADER_PROBE_BYTES);
        }
        for (int i = 0; i < head.length; i++) {
            if (head[i] == '\n') {
                return java.util.Arrays.copyOf(head, i);
            }
        }
        return head;
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

    /**
     * 페이지에서 이 데이터셋의 다운로드 버튼 인자를 읽는다.
     *
     * <p>첫 인자(publicDataPk)가 {@code datasetId} 와 같은 호출만 본다. 2026-09-23 페이지에는 호출이
     * 하나뿐이지만, 관련 데이터셋이나 이력 버튼이 앞에 붙으면 남의 파일을 받아 스냅샷으로 굳힐 수 있다.
     * 같은 데이터셋 호출이 여럿이면 첫 번째를 쓴다.
     */
    static DownloadTrigger parseDownloadTrigger(String html, String datasetId) {
        if (html == null || html.isBlank()) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID, "빈 페이지");
        }
        Matcher matcher = DOWNLOAD_TRIGGER_PATTERN.matcher(html);
        int calls = 0;
        while (matcher.find()) {
            calls++;
            if (!matcher.group(1).trim().equals(datasetId)) {
                continue;
            }
            DownloadTrigger trigger = new DownloadTrigger(
                matcher.group(1).trim(), matcher.group(2).trim(), matcher.group(3).trim(), matcher.group(4).trim());
            if (trigger.publicDataDetailPk().isEmpty()) {
                throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID,
                    "fn_fileDataDown 상세 PK 비어 있음 publicDataPk='%s'".formatted(trigger.publicDataPk()));
            }
            return trigger;
        }
        throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID,
            "datasetId=%s 의 fn_fileDataDown 호출 없음 (calls=%d pageChars=%d)"
                .formatted(datasetId, calls, html.length()));
    }

    /**
     * {@code selectFileDataDownload.do} 응답에서 지금 올라와 있는 파일을 읽는다.
     *
     * <p>응답은 {@code Content-Type: text/html} 이지만 본문은 JSON 이다. 쓰는 것은 최상위
     * {@code status}·{@code atchFileId}·{@code fileDetailSn} 셋이고, 실패면 {@code status=false}
     * 와 {@code error} 문구가 온다.
     *
     * <p>{@code dataSetFileDetailInfo.publicDataPk} 가 있으면 {@code datasetId} 와 대조한다 — 페이지에서
     * 버튼을 고를 때와 같은 방어다. 남의 파일이 스냅샷으로 굳으면 다음 실행부터 조용히 SKIP 된다.
     */
    static OlleCourseSourceQueryResult parseDownloadTicket(String json, String baseUrl, String datasetId) {
        if (json == null || json.isBlank()) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID, "다운로드 티켓 빈 응답");
        }
        JsonNode tree;
        try {
            tree = OBJECT_MAPPER.readTree(json.trim());
        } catch (JsonProcessingException exception) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID,
                "다운로드 티켓이 JSON 이 아님 (%s)".formatted(exception.getOriginalMessage()));
        }
        if (!tree.path("status").asBoolean(false)) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID,
                "다운로드 티켓 status=false error=%s".formatted(text(tree, "error")));
        }
        String ticketDatasetId = text(tree.path("dataSetFileDetailInfo"), "publicDataPk");
        if (ticketDatasetId != null && !ticketDatasetId.isBlank() && !ticketDatasetId.trim().equals(datasetId)) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID,
                "다운로드 티켓 publicDataPk=%s 가 datasetId=%s 와 다름".formatted(ticketDatasetId, datasetId));
        }

        String fileId = text(tree, "atchFileId");
        String fileDetailSn = text(tree, "fileDetailSn");
        if (fileId == null || fileId.isBlank() || fileDetailSn == null || fileDetailSn.isBlank()) {
            throw new WalkCourseImportException(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID,
                "다운로드 티켓에 atchFileId·fileDetailSn 없음");
        }
        // 인코딩하지 않은 문자열로 만든다. UriComponentsBuilder.toUriString() 은 encode 까지 하므로
        // build().toUriString() 을 쓴다 - 문자열 URI 는 openApiWebClient 의 DefaultUriBuilderFactory 가
        // 보낼 때 한 번 인코딩한다. 여기서도 하면 두 번이 된다.
        String contentUrl = UriComponentsBuilder.fromUriString(baseUrl + FILE_DOWNLOAD_PATH)
            .queryParam("atchFileId", fileId)
            .queryParam("fileDetailSn", fileDetailSn)
            .build()
            .toUriString();
        return new OlleCourseSourceQueryResult(fileId, fileDetailSn, contentUrl);
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

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || !value.isValueNode() || value.isNull() ? null : value.asText();
    }

    /**
     * 다운로드 버튼 {@code fn_fileDataDown} 의 앞 네 인자.
     *
     * @param publicDataPk       데이터셋 번호 ({@code 15043496})
     * @param publicDataDetailPk {@code uddi:} 로 시작하는 상세 PK
     * @param atchFileId         페이지에서는 빈 값이다. 버튼이 보내는 그대로 넘긴다
     * @param fileDetailSn       파일 순번
     */
    record DownloadTrigger(String publicDataPk, String publicDataDetailPk, String atchFileId, String fileDetailSn) {

        MultiValueMap<String, String> toFormData() {
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("publicDataPk", publicDataPk);
            form.add("publicDataDetailPk", publicDataDetailPk);
            form.add("atchFileId", atchFileId);
            form.add("fileDetailSn", fileDetailSn);
            form.add("publicDataTyCode", FILE_DATA_TYPE_CODE);
            return form;
        }
    }
}
