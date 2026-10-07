package com.example.kanban;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

// Priority と DB の cards.priority 列（VARCHAR の high・mid・low）の変換
@Converter(autoApply = true)
public class PriorityAttributeConverter implements AttributeConverter<Priority, String> {

	@Override
	public String convertToDatabaseColumn(Priority priority) {
		return (priority != null) ? priority.value() : null;
	}

	@Override
	public Priority convertToEntityAttribute(String value) {
		return (value != null) ? Priority.from(value) : null;
	}

}
