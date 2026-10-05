package com.example.kanban;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// リストの追加・名前変更・削除（F-01）
@RestController
@RequestMapping("/api/lists")
public class ListController {

	// 送られてくる JSON：{"title": "やること"}
	record ListRequest(@NotBlank @Size(max = 100) String title) {
	}

	private final BoardService boardService;

	public ListController(BoardService boardService) {
		this.boardService = boardService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ListResponse create(@Valid @RequestBody ListRequest request) {
		return boardService.createList(request.title().strip());
	}

	@PatchMapping("/{id}")
	public ListResponse rename(@PathVariable Long id, @Valid @RequestBody ListRequest request) {
		return boardService.renameList(id, request.title().strip());
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable Long id) {
		boardService.deleteList(id);
	}

}
