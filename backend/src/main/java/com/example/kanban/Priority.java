package com.example.kanban;

import java.util.Arrays;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

// カードの優先順位（F-08）。JSON・DB・クエリパラメーターでは小文字の high・mid・low で表す。
// 並び順（HIGH → MID → LOW）は期限順の並べ替え（F-09）で使う
public enum Priority {

	HIGH("high"), MID("mid"), LOW("low");

	private final String value;

	Priority(String value) {
		this.value = value;
	}

	@JsonValue
	public String value() {
		return this.value;
	}

	// high・mid・low 以外は IllegalArgumentException（API では 400 になる）
	@JsonCreator
	public static Priority from(String value) {
		return Arrays.stream(values())
			.filter(p -> p.value.equals(value))
			.findFirst()
			.orElseThrow(() -> new IllegalArgumentException("優先順位は high・mid・low のどれかです: " + value));
	}

}
