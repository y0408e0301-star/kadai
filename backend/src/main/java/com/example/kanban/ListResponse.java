package com.example.kanban;

import java.util.List;

// API が返すリスト 1 つ分の JSON。cards は position 順
public record ListResponse(Long id, String title, List<CardResponse> cards) {

	static ListResponse from(TaskList list, List<CardResponse> cards) {
		return new ListResponse(list.getId(), list.getTitle(), cards);
	}

}
