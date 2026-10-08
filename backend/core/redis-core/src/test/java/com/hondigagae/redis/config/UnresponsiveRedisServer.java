package com.hondigagae.redis.config;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 연결과 핸드셰이크에는 답하고 {@code EXISTS} 에만 답하지 않는 가짜 Redis (#1253).
 *
 * <p>"Redis 가 먹통이다"(패킷 드롭 · 응답 없음)를 재현한다. 연결을 거부하면 바로 실패하므로 명령 타임아웃을
 * 볼 수 없고, 처음부터 아무 답도 하지 않으면 핸드셰이크에서 연결 실패로 끝난다. <b>연결은 살아 있는데
 * 명령에 답이 없는</b> 상태라야 명령 타임아웃이 무엇으로 나오는지 볼 수 있다.
 *
 * <p>Lettuce 6.4 의 핸드셰이크 순서에 맞춘다 — {@code HELLO 3} 를 모른다고 답하면 RESP2 로 내려가
 * {@code PING} 을 보내고, 이어서 {@code CLIENT SETINFO} 를 보낸다(실패해도 무시된다).
 */
final class UnresponsiveRedisServer implements AutoCloseable {

    private final ServerSocket serverSocket;
    private final ExecutorService executor = Executors.newCachedThreadPool(runnable -> {
        Thread thread = new Thread(runnable, "unresponsive-redis");
        thread.setDaemon(true);
        return thread;
    });
    private final List<Socket> clients = new CopyOnWriteArrayList<>();

    UnresponsiveRedisServer() throws IOException {
        this.serverSocket = new ServerSocket(0, 50, InetAddress.getLoopbackAddress());
        executor.execute(this::acceptLoop);
    }

    String host() {
        return serverSocket.getInetAddress().getHostAddress();
    }

    int port() {
        return serverSocket.getLocalPort();
    }

    private void acceptLoop() {
        while (!serverSocket.isClosed()) {
            try {
                Socket client = serverSocket.accept();
                clients.add(client);
                executor.execute(() -> serve(client));
            } catch (IOException closed) {
                return;
            }
        }
    }

    private void serve(Socket client) {
        try (client; InputStream in = new BufferedInputStream(client.getInputStream()); OutputStream out = client.getOutputStream()) {
            List<String> command;
            while ((command = readCommand(in)) != null) {
                String reply = reply(command.get(0).toUpperCase(Locale.ROOT));
                if (reply != null) {
                    out.write(reply.getBytes(StandardCharsets.US_ASCII));
                    out.flush();
                }
            }
        } catch (IOException closed) {
            // 테스트가 끝나 소켓을 닫았다.
        }
    }

    private static String reply(String commandName) {
        return switch (commandName) {
            case "HELLO" -> "-ERR unknown command 'HELLO'\r\n";
            case "PING" -> "+PONG\r\n";
            case "EXISTS" -> null;
            default -> "+OK\r\n";
        };
    }

    /** RESP 요청 하나 — {@code *<개수>} 뒤에 {@code $<길이>} + 본문이 개수만큼 온다. 스트림이 끝나면 null. */
    private static List<String> readCommand(InputStream in) throws IOException {
        String header = readLine(in);
        if (header == null) {
            return null;
        }
        if (!header.startsWith("*")) {
            throw new IOException("RESP 배열이 아닙니다: " + header);
        }
        int count = Integer.parseInt(header.substring(1));
        List<String> parts = new ArrayList<>(count);
        for (int index = 0; index < count; index++) {
            String lengthLine = readLine(in);
            if (lengthLine == null) {
                return null;
            }
            byte[] body = in.readNBytes(Integer.parseInt(lengthLine.substring(1)));
            readLine(in);
            parts.add(new String(body, StandardCharsets.UTF_8));
        }
        return parts;
    }

    private static String readLine(InputStream in) throws IOException {
        StringBuilder line = new StringBuilder();
        int current;
        while ((current = in.read()) != -1) {
            if (current == '\r') {
                in.read();
                return line.toString();
            }
            line.append((char) current);
        }
        return null;
    }

    @Override
    public void close() throws IOException {
        serverSocket.close();
        for (Socket client : clients) {
            client.close();
        }
        executor.shutdownNow();
    }
}
