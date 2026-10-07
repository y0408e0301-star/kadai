package com.example.kanban;

import java.time.LocalDate;

// API が返すカード 1 枚分の JSON
public record CardResponse(Long id, String title, Priority priority, LocalDate due) {

	static CardResponse from(Card card) {
		return new CardResponse(card.getId(), card.getTitle(), card.getPriority(), card.getDue());
	}

}
