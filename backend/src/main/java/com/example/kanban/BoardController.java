package com.example.kanban;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// GET /api/board：ボード全体を返す（要件定義書 6. データ構造の JSON の形）
@RestController
public class BoardController {

	record BoardResponse(List<ListResponse> lists) {
	}

	private final BoardService boardService;

	public BoardController(BoardService boardService) {
		this.boardService = boardService;
	}

	@GetMapping("/api/board")
	public BoardResponse board() {
		return new BoardResponse(boardService.getBoard());
	}

}
