package com.hondigagae.common.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "jasypt.encryptor")
public record JasyptProperties(
    String key
) {

}
