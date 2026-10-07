package com.example.kanban;

import java.time.LocalDate;

// カードの検索・1 枚取得で返す JSON。どのリストに入っているかも付ける
public record CardDetailResponse(Long id, Long listId, String listTitle, String title, Priority priority,
		LocalDate due) {

	static CardDetailResponse from(Card card) {
		TaskList list = card.getList();
		return new CardDetailResponse(card.getId(), list.getId(), list.getTitle(), card.getTitle(), card.getPriority(),
				card.getDue());
	}

}
