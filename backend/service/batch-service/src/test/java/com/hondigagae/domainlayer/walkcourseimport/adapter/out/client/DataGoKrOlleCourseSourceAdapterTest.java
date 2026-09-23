package com.hondigagae.domainlayer.walkcourseimport.adapter.out.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hondigagae.domainlayer.walkcourseimport.adapter.out.client.DataGoKrOlleCourseSourceAdapter.DownloadTrigger;
import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportErrorCode;
import com.hondigagae.domainlayer.walkcourseimport.application.exception.WalkCourseImportException;
import com.hondigagae.domainlayer.walkcourseimport.application.port.out.query.OlleCourseSourceQueryResult;
import com.hondigagae.global.properties.OlleCourseProperties;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.codec.HttpMessageWriter;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.client.reactive.MockClientHttpRequest;
import org.springframework.web.reactive.function.BodyInserter;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

class DataGoKrOlleCourseSourceAdapterTest {

    private static final String BASE_URL = "https://www.data.go.kr";
    private static final String DATASET_ID = "15043496";
    private static final String PAGE_RESOURCE = "/walkcourseimport/datagokr-olle-page-20260923.html";
    private static final String TICKET_RESOURCE = "/walkcourseimport/datagokr-olle-download-ticket-20260923.json";

    private static String resource(String name) throws IOException {
        try (InputStream in = DataGoKrOlleCourseSourceAdapterTest.class.getResourceAsStream(name)) {
            assertThat(in).as(name).isNotNull();
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static WalkCourseImportErrorCode errorCodeOf(Throwable exception) {
        return ((WalkCourseImportException) exception).getErrorCode();
    }

    @Nested
    @DisplayName("상세 페이지의 다운로드 버튼 인자")
    class ParseDownloadTrigger {

        @Test
        @DisplayName("실제 페이지(2026-09-23)에서 publicDataPk·uddi 상세 PK·fileDetailSn 을 뽑는다")
        void extractsTriggerFromRealPage() throws IOException {
            DownloadTrigger trigger = DataGoKrOlleCourseSourceAdapter.parseDownloadTrigger(resource(PAGE_RESOURCE), DATASET_ID);

            assertThat(trigger.publicDataPk()).isEqualTo("15043496");
            assertThat(trigger.publicDataDetailPk()).isEqualTo("uddi:5e0b77df-759d-4378-a74f-bd393051521b");
            assertThat(trigger.atchFileId()).isEmpty();
            assertThat(trigger.fileDetailSn()).isEqualTo("1");
        }

        @Test
        @DisplayName("버튼이 보내는 폼 그대로 티켓 요청 본문을 만든다")
        void buildsTicketFormLikeTheButton() throws IOException {
            DownloadTrigger trigger = DataGoKrOlleCourseSourceAdapter.parseDownloadTrigger(resource(PAGE_RESOURCE), DATASET_ID);

            assertThat(trigger.toFormData().toSingleValueMap()).containsExactlyInAnyOrderEntriesOf(Map.of(
                "publicDataPk", "15043496",
                "publicDataDetailPk", "uddi:5e0b77df-759d-4378-a74f-bd393051521b",
                "atchFileId", "",
                "fileDetailSn", "1",
                "publicDataTyCode", "PR0051"));
        }

        @Test
        @DisplayName("실제 페이지의 JSON-LD 는 JSON 으로 읽히지 않는다 — 옛 전략이 매번 우회로 빠지던 원인 (#876)")
        void realPageJsonLdIsNotValidJson() throws IOException {
            String html = resource(PAGE_RESOURCE);
            int marker = html.indexOf("application/ld+json");
            String jsonLd = html.substring(html.indexOf('>', marker) + 1, html.indexOf("</script>", marker));

            assertThat(jsonLd).contains("\"DataDownload\"");
            assertThatThrownBy(() -> new ObjectMapper().readTree(jsonLd))
                .isInstanceOf(JsonProcessingException.class);
        }

        @Test
        @DisplayName("큰따옴표 인자도 읽는다")
        void acceptsDoubleQuotedArguments() {
            String html = "<a href=\"#\" data-x='fn_fileDataDown(\"15043496\", \"uddi:abc\", \"\", \"2\", \"1\")'>";

            DownloadTrigger trigger = DataGoKrOlleCourseSourceAdapter.parseDownloadTrigger(html, DATASET_ID);

            assertThat(trigger.publicDataDetailPk()).isEqualTo("uddi:abc");
            assertThat(trigger.fileDetailSn()).isEqualTo("2");
        }

        @Test
        @DisplayName("버튼이 없으면 SOURCE_PAGE_INVALID 이고 페이지 크기를 함께 남긴다")
        void failsWhenNoTrigger() {
            String html = "<html><body>점검 중입니다</body></html>";

            assertThatThrownBy(() -> DataGoKrOlleCourseSourceAdapter.parseDownloadTrigger(html, DATASET_ID))
                .isInstanceOf(WalkCourseImportException.class)
                .hasMessageContaining("fn_fileDataDown 호출 없음")
                .hasMessageContaining("calls=0 pageChars=" + html.length())
                .extracting(DataGoKrOlleCourseSourceAdapterTest::errorCodeOf)
                .isEqualTo(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID);
        }

        @Test
        @DisplayName("다른 데이터셋 버튼이 앞에 있어도 datasetId 가 같은 호출을 고른다 — 남의 파일을 스냅샷으로 굳히지 않는다")
        void skipsOtherDatasetTrigger() {
            String html = "fn_fileDataDown('15099999', 'uddi:other', '', '1', '1')"
                + " fn_fileDataDown('15043496', 'uddi:olle', '', '1', '1')";

            assertThat(DataGoKrOlleCourseSourceAdapter.parseDownloadTrigger(html, DATASET_ID).publicDataDetailPk())
                .isEqualTo("uddi:olle");
        }

        @Test
        @DisplayName("다른 데이터셋 버튼만 있으면 SOURCE_PAGE_INVALID 이고 찾은 호출 수를 남긴다")
        void failsWhenOnlyOtherDataset() {
            String html = "fn_fileDataDown('15099999', 'uddi:other', '', '1', '1')";

            assertThatThrownBy(() -> DataGoKrOlleCourseSourceAdapter.parseDownloadTrigger(html, DATASET_ID))
                .isInstanceOf(WalkCourseImportException.class)
                .hasMessageContaining("calls=1")
                .extracting(DataGoKrOlleCourseSourceAdapterTest::errorCodeOf)
                .isEqualTo(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID);
        }

        @Test
        @DisplayName("상세 PK 가 비어 있으면 SOURCE_PAGE_INVALID")
        void failsWhenDetailPkBlank() {
            String html = "fn_fileDataDown('15043496', '', '', '1', '1')";

            assertThatThrownBy(() -> DataGoKrOlleCourseSourceAdapter.parseDownloadTrigger(html, DATASET_ID))
                .isInstanceOf(WalkCourseImportException.class)
                .extracting(DataGoKrOlleCourseSourceAdapterTest::errorCodeOf)
                .isEqualTo(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID);
        }
    }

    @Nested
    @DisplayName("다운로드 티켓 응답")
    class ParseDownloadTicket {

        @Test
        @DisplayName("실제 응답(2026-09-23)에서 atchFileId·fileDetailSn 을 읽어 fileDownload.do 주소를 만든다")
        void buildsDownloadUrlFromRealTicket() throws IOException {
            OlleCourseSourceQueryResult source =
                DataGoKrOlleCourseSourceAdapter.parseDownloadTicket(resource(TICKET_RESOURCE), BASE_URL);

            assertThat(source.fileId()).isEqualTo("FILE_000000007665534");
            assertThat(source.fileDetailSn()).isEqualTo("1");
            assertThat(source.contentUrl())
                .isEqualTo("https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000007665534&fileDetailSn=1");
        }

        @Test
        @DisplayName("fileDetailSn 이 숫자로 와도 읽는다")
        void acceptsNumericFileDetailSn() {
            String json = "{\"status\":true,\"atchFileId\":\"FILE_1\",\"fileDetailSn\":2}";

            assertThat(DataGoKrOlleCourseSourceAdapter.parseDownloadTicket(json, BASE_URL).fileDetailSn()).isEqualTo("2");
        }

        @Test
        @DisplayName("status=false 면 포털이 준 error 문구와 함께 SOURCE_PAGE_INVALID")
        void failsWhenStatusFalse() {
            String json = "{\"status\":false,\"error\":\"파일이 존재하지 않습니다.\"}";

            assertThatThrownBy(() -> DataGoKrOlleCourseSourceAdapter.parseDownloadTicket(json, BASE_URL))
                .isInstanceOf(WalkCourseImportException.class)
                .hasMessageContaining("status=false")
                .hasMessageContaining("파일이 존재하지 않습니다.")
                .extracting(DataGoKrOlleCourseSourceAdapterTest::errorCodeOf)
                .isEqualTo(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID);
        }

        @Test
        @DisplayName("JSON 이 아니면(점검 HTML) SOURCE_PAGE_INVALID")
        void failsWhenNotJson() {
            assertThatThrownBy(() -> DataGoKrOlleCourseSourceAdapter.parseDownloadTicket("<html>점검</html>", BASE_URL))
                .isInstanceOf(WalkCourseImportException.class)
                .extracting(DataGoKrOlleCourseSourceAdapterTest::errorCodeOf)
                .isEqualTo(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID);
        }

        @Test
        @DisplayName("status=true 인데 atchFileId 가 비어 있으면 SOURCE_PAGE_INVALID")
        void failsWhenFileIdMissing() {
            String json = "{\"status\":true,\"atchFileId\":\"\",\"fileDetailSn\":\"1\"}";

            assertThatThrownBy(() -> DataGoKrOlleCourseSourceAdapter.parseDownloadTicket(json, BASE_URL))
                .isInstanceOf(WalkCourseImportException.class)
                .extracting(DataGoKrOlleCourseSourceAdapterTest::errorCodeOf)
                .isEqualTo(WalkCourseImportErrorCode.SOURCE_PAGE_INVALID);
        }
    }

    @Nested
    @DisplayName("resolveLatest — 페이지 → 다운로드 티켓 순서")
    class ResolveLatest {

        private final List<String> calls = new ArrayList<>();
        private final List<String> ticketForms = new ArrayList<>();

        private DataGoKrOlleCourseSourceAdapter adapter(HttpStatus ticketStatus, String ticketBody) {
            ExchangeStrategies strategies = ExchangeStrategies.withDefaults();
            WebClient webClient = WebClient.builder()
                .exchangeStrategies(strategies)
                .exchangeFunction(request -> {
                    calls.add(request.method() + " " + request.url() + " referer=" + request.headers().getFirst(HttpHeaders.REFERER));
                    if (request.method() == HttpMethod.GET) {
                        return Mono.just(ClientResponse.create(HttpStatus.OK, strategies)
                            .header(HttpHeaders.CONTENT_TYPE, "text/html;charset=UTF-8")
                            .body(uncheckedResource(PAGE_RESOURCE))
                            .build());
                    }
                    ticketForms.add(formBody(request, strategies));
                    return Mono.just(ClientResponse.create(ticketStatus, strategies)
                        .header(HttpHeaders.CONTENT_TYPE, "text/html;charset=UTF-8")
                        .body(ticketBody)
                        .build());
                })
                .build();
            return new DataGoKrOlleCourseSourceAdapter(webClient,
                new OlleCourseProperties(null, true, BASE_URL, DATASET_ID, null, 5_000, 1L),
                CircuitBreakerRegistry.ofDefaults());
        }

        @Test
        @DisplayName("페이지를 읽고 버튼과 같은 폼으로 티켓을 요청해 fileDownload.do 주소를 만든다")
        void resolvesThroughTicket() throws IOException {
            OlleCourseSourceQueryResult source = adapter(HttpStatus.OK, resource(TICKET_RESOURCE)).resolveLatest();

            assertThat(source.fileId()).isEqualTo("FILE_000000007665534");
            assertThat(source.contentUrl())
                .isEqualTo(BASE_URL + "/cmm/cmm/fileDownload.do?atchFileId=FILE_000000007665534&fileDetailSn=1");
            assertThat(calls).containsExactly(
                "GET " + BASE_URL + "/data/15043496/fileData.do referer=null",
                "POST " + BASE_URL + "/tcs/dss/selectFileDataDownload.do referer=" + BASE_URL + "/data/15043496/fileData.do");
            assertThat(ticketForms).singleElement().asString()
                .contains("publicDataPk=15043496")
                .contains("publicDataDetailPk=uddi%3A5e0b77df-759d-4378-a74f-bd393051521b")
                .contains("fileDetailSn=1")
                .contains("publicDataTyCode=PR0051");
        }

        @Test
        @DisplayName("티켓 요청이 5xx 면 SOURCE_PAGE_FAILED — 프로세서가 로컬 우회로 물러난다")
        void ticketServerErrorIsSourcePageFailed() {
            assertThatThrownBy(() -> adapter(HttpStatus.INTERNAL_SERVER_ERROR, "오류").resolveLatest())
                .isInstanceOf(WalkCourseImportException.class)
                .extracting(DataGoKrOlleCourseSourceAdapterTest::errorCodeOf)
                .isEqualTo(WalkCourseImportErrorCode.SOURCE_PAGE_FAILED);
        }

        private static String uncheckedResource(String name) {
            try {
                return resource(name);
            } catch (IOException exception) {
                throw new UncheckedIOException(exception);
            }
        }

        private static String formBody(ClientRequest request, ExchangeStrategies strategies) {
            MockClientHttpRequest captured = new MockClientHttpRequest(request.method(), request.url());
            request.body().insert(captured, new BodyInserter.Context() {
                @Override
                public List<HttpMessageWriter<?>> messageWriters() {
                    return strategies.messageWriters();
                }

                @Override
                public Optional<ServerHttpRequest> serverRequest() {
                    return Optional.empty();
                }

                @Override
                public Map<String, Object> hints() {
                    return Map.of();
                }
            }).block();
            return captured.getBodyAsString().block();
        }
    }

    @Nested
    @DisplayName("내려받은 파일 최소 검증")
    class Validate {

        @TempDir
        Path tempDir;

        private DataGoKrOlleCourseSourceAdapter adapter(long minContentLength) {
            return new DataGoKrOlleCourseSourceAdapter(null,
                new OlleCourseProperties(null, true, null, null, tempDir.toString(), 0, minContentLength), null);
        }

        private Path write(String content, Charset charset) throws IOException {
            Path file = tempDir.resolve("downloaded.csv");
            Files.write(file, content.getBytes(charset));
            return file;
        }

        @Test
        @DisplayName("UTF-8 헤더에 코스별이 있고 크기가 충분하면 통과한다")
        void acceptsUtf8Csv() throws IOException {
            Path file = write("코스별,코스명,거리,소요시간정보,시종점정보,데이터기준일자\n1코스,시흥-광치기,15.1km,4~5시간,시점-종점,2025-04-28\n",
                StandardCharsets.UTF_8);

            adapter(1).validate(file, Files.size(file), Files.size(file));
        }

        @Test
        @DisplayName("포털 원본(CP949)도 첫 줄 코스별로 통과한다")
        void acceptsMs949Csv() throws IOException {
            Path file = write("코스별,코스명,거리\n1코스,시흥-광치기,15.1km\n", Charset.forName("MS949"));

            adapter(1).validate(file, Files.size(file), Files.size(file));
        }

        @Test
        @DisplayName("헤더 크기와 실제 크기가 다르면 DOWNLOAD_INVALID")
        void rejectsTruncatedTransfer() throws IOException {
            Path file = write("코스별,코스명\n1코스,시흥-광치기\n", StandardCharsets.UTF_8);

            assertThatThrownBy(() -> adapter(1).validate(file, Files.size(file), 30_000L))
                .isInstanceOf(WalkCourseImportException.class)
                .hasMessageContaining("Content-Length")
                .extracting(DataGoKrOlleCourseSourceAdapterTest::errorCodeOf)
                .isEqualTo(WalkCourseImportErrorCode.DOWNLOAD_INVALID);
        }

        @Test
        @DisplayName("점검 안내 HTML 을 200 으로 받아도 첫 줄에서 걸러낸다")
        void rejectsHtmlErrorPage() throws IOException {
            Path file = write("<!DOCTYPE html><html><head><title>서비스 점검 안내</title></head>\n", StandardCharsets.UTF_8);

            assertThatThrownBy(() -> adapter(1).validate(file, Files.size(file), Files.size(file)))
                .isInstanceOf(WalkCourseImportException.class)
                .extracting(DataGoKrOlleCourseSourceAdapterTest::errorCodeOf)
                .isEqualTo(WalkCourseImportErrorCode.DOWNLOAD_INVALID);
        }
    }
}
