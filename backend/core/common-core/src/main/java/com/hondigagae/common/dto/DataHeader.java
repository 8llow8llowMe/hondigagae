package com.hondigagae.common.dto;

public record DataHeader(boolean success, String resultCode, Object resultMessage) {

    public static DataHeader ok() {
        return new DataHeader(true, null, null);
    }

    public static DataHeader error(String resultCode, Object resultMessage) {
        return new DataHeader(false, resultCode, resultMessage);
    }
}
