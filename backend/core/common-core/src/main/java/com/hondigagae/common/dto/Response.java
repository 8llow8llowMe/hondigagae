package com.hondigagae.common.dto;

public record Response<T>(DataHeader dataHeader, T dataBody) {

    public static <T> Response<T> success(T dataBody) {
        return new Response<>(DataHeader.ok(), dataBody);
    }

    public static Response<Void> success() {
        return new Response<>(DataHeader.ok(), null);
    }

    public static <T> Response<T> fail(String resultCode, Object resultMessage) {
        return new Response<>(DataHeader.error(resultCode, resultMessage), null);
    }
}
