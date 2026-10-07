package com.example.kanban;

import org.springframework.core.convert.converter.Converter;
import org.springframework.stereotype.Component;

// クエリパラメーター（GET /api/cards?priority=high）を Priority にする。Spring Boot が自動で登録する
@Component
public class StringToPriorityConverter implements Converter<String, Priority> {

	@Override
	public Priority convert(String value) {
		return Priority.from(value);
	}

}
