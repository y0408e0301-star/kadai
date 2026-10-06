package com.example.kanban;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

// ボード全体の取得（要件定義書 6. データ構造の JSON の形）と、期限順の並べ替え（F-09）
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

	// 各リストのカードを期限順に並べ替えて保存し、並べ替えたあとのボードを返す
	@PostMapping("/api/board/sort-by-due")
	public BoardResponse sortByDue() {
		boardService.sortCardsByDue();
		return new BoardResponse(boardService.getBoard());
	}

}
